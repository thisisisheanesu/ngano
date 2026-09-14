//! Streaming loader: catalogue selection in, canonical rows out.

use std::collections::VecDeque;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Duration;

use futures::stream::{BoxStream, Stream};

use crate::catalogue::{Catalogue, Inner as CatalogueInner};
use crate::error::{NganoError, Result};
use crate::field_map::{ColumnMap, FieldMap};
use crate::filter::Filter;
use crate::hf::{HfClient, SplitRef, DEFAULT_HF_BASE, MAX_PAGE_ROWS};
use crate::http::{DEFAULT_BACKOFF, DEFAULT_MAX_RETRIES};
use crate::model::Dataset;
use crate::row::{Row, RowContext};

/// How rows from several datasets are combined into one stream.
///
/// Exactly one dataset is read from at a time, so the order is deterministic
/// and only one page is ever in memory. A dataset that is exhausted drops out
/// of the rotation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Interleave {
    /// Take one row from each dataset in turn. The default.
    #[default]
    RoundRobin,
    /// Drain each dataset fully before moving to the next.
    Sequential,
    /// Sample datasets in proportion to their countable hours, using smooth
    /// weighted round robin. Datasets without a usable hours figure weigh 1.
    WeightedByHours,
}

/// Builder for a row stream.
///
/// ```no_run
/// use futures::TryStreamExt;
/// use ngano::{Filter, Interleave, Loader};
///
/// # async fn run() -> Result<(), ngano::NganoError> {
/// let mut stream = Loader::new()
///     .filter(Filter::new().language("sna").country("ZW").commercial(true))
///     .split("train")
///     .hf_token(std::env::var("HF_TOKEN").ok())
///     .interleave(Interleave::RoundRobin)
///     .limit(Some(1000))
///     .stream()
///     .await?;
///
/// while let Some(row) = stream.try_next().await? {
///     println!("{:?} {:?}", row.language, row.transcript);
///     if let Some(a) = &row.audio {
///         let _bytes = a.read().await?;
///     }
///
/// }
/// # Ok(()) }
/// ```
#[derive(Debug, Clone)]
pub struct Loader {
    catalogue: Option<Catalogue>,
    field_map: Option<FieldMap>,
    filter: Filter,
    ids: Vec<String>,
    repos: Vec<String>,
    split: Option<String>,
    config: Option<String>,
    token: Option<String>,
    interleave: Interleave,
    limit: Option<usize>,
    max_datasets: Option<usize>,
    page_size: usize,
    base: String,
    max_retries: u32,
    backoff: Duration,
}

impl Default for Loader {
    fn default() -> Self {
        Self::new()
    }
}

impl Loader {
    /// A loader over the bundled catalogue, with no filter and no limit.
    #[must_use]
    pub fn new() -> Self {
        Self {
            catalogue: None,
            field_map: None,
            filter: Filter::new(),
            ids: Vec::new(),
            repos: Vec::new(),
            split: None,
            config: None,
            token: None,
            interleave: Interleave::default(),
            limit: None,
            max_datasets: None,
            page_size: MAX_PAGE_ROWS,
            base: DEFAULT_HF_BASE.to_string(),
            max_retries: DEFAULT_MAX_RETRIES,
            backoff: DEFAULT_BACKOFF,
        }
    }

    /// Use a catalogue you already hold, rather than the bundled snapshot.
    #[must_use]
    pub fn catalogue(mut self, catalogue: Catalogue) -> Self {
        self.catalogue = Some(catalogue);
        self
    }

    /// Use a column mapping table you already hold, rather than the bundled one.
    #[must_use]
    pub fn field_map(mut self, field_map: FieldMap) -> Self {
        self.field_map = Some(field_map);
        self
    }

    /// Choose datasets by filter. Only datasets with a Hugging Face repo can be
    /// streamed, so the loader drops the rest.
    #[must_use]
    pub fn filter(mut self, filter: Filter) -> Self {
        self.filter = filter;
        self
    }

    /// Stream one dataset by its ngano catalogue id. Repeat the call to add
    /// more. Naming a dataset id or a repo replaces the filter. For an
    /// arbitrary Hugging Face repo, use [`Loader::repo`].
    #[must_use]
    pub fn dataset(mut self, id: impl Into<String>) -> Self {
        self.ids.push(id.into());
        self
    }

    /// Stream a Hugging Face repo directly, whether or not the catalogue lists
    /// it. Repeat the call to add more.
    ///
    /// This is the Rust spelling of `load_dataset("google/fleurs", config=...)`
    /// in the Python SDK and `loadDataset("google/fleurs", {config: ...})` in
    /// the JavaScript one. Pair it with [`Loader::config`] to pick one config.
    ///
    /// When the repo is in the catalogue, its record supplies the licence and
    /// the language, country and domain fallbacks. When it is not, rows come
    /// back with `dataset_id: None`, `licence: "Unstated"` and
    /// `source_url: https://huggingface.co/datasets/{repo}`.
    ///
    /// Naming a repo or a dataset id replaces the filter.
    ///
    /// ```no_run
    /// use ngano::Loader;
    ///
    /// # async fn run() -> Result<(), ngano::NganoError> {
    /// let stream = Loader::new()
    ///     .repo("google/fleurs")
    ///     .config("sw_ke")
    ///     .split("train")
    ///     .limit(Some(100))
    ///     .stream()
    ///     .await?;
    /// # let _ = stream;
    /// # Ok(()) }
    /// ```
    #[must_use]
    pub fn repo(mut self, repo: impl Into<String>) -> Self {
        self.repos.push(repo.into());
        self
    }

    /// Keep only splits with this name, for example `train`.
    #[must_use]
    pub fn split(mut self, split: impl Into<String>) -> Self {
        self.split = Some(split.into());
        self
    }

    /// Keep only this config, for example a per-language config name.
    #[must_use]
    pub fn config(mut self, config: impl Into<String>) -> Self {
        self.config = Some(config.into());
        self
    }

    /// Bearer token for gated or private datasets.
    #[must_use]
    pub fn hf_token(mut self, token: Option<String>) -> Self {
        self.token = token;
        self
    }

    /// Choose how several datasets are combined.
    #[must_use]
    pub fn interleave(mut self, mode: Interleave) -> Self {
        self.interleave = mode;
        self
    }

    /// Stop after this many rows in total.
    #[must_use]
    pub fn limit(mut self, limit: Option<usize>) -> Self {
        self.limit = limit;
        self
    }

    /// Stream at most this many datasets, in catalogue order.
    #[must_use]
    pub fn max_datasets(mut self, max: Option<usize>) -> Self {
        self.max_datasets = max;
        self
    }

    /// Rows per request. Clamped to the server's cap of 100.
    #[must_use]
    pub fn page_size(mut self, rows: usize) -> Self {
        self.page_size = rows.clamp(1, MAX_PAGE_ROWS);
        self
    }

    /// Point the loader at another datasets-server, for a mirror or a test.
    #[must_use]
    pub fn api_base(mut self, base: impl Into<String>) -> Self {
        self.base = base.into();
        self
    }

    /// Retry budget for `429` and `5xx` responses, and the first backoff step.
    /// Backoff doubles per attempt and is jittered.
    #[must_use]
    pub fn retries(mut self, max_retries: u32, backoff: Duration) -> Self {
        self.max_retries = max_retries;
        self.backoff = backoff;
        self
    }

    /// The catalogue records this loader would stream, in selection order.
    ///
    /// A repo passed to [`Loader::repo`] that the catalogue does not list has no
    /// record to return, so it does not appear here, though it is still streamed.
    ///
    /// ```
    /// use ngano::{Filter, Loader};
    ///
    /// let picks = Loader::new()
    ///     .filter(Filter::new().language("sna"))
    ///     .selection()?;
    /// assert!(picks.iter().all(|d| d.is_streamable()));
    /// assert!(picks.iter().all(|d| d.language_tags.iter().any(|t| t == "sna")));
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn selection(&self) -> Result<Vec<Dataset>> {
        let catalogue = self.resolved_catalogue()?;
        let targets = self.targets(&catalogue)?;
        Ok(targets
            .iter()
            .filter_map(|t| t.dataset_id.as_deref())
            .filter_map(|id| catalogue.get(id).cloned())
            .collect())
    }

    /// The catalogue to work against: the one supplied, or the bundled snapshot.
    fn resolved_catalogue(&self) -> Result<Catalogue> {
        match &self.catalogue {
            Some(c) => Ok(c.clone()),
            None => Catalogue::bundled(),
        }
    }

    /// Resolve the configuration into the concrete things to stream.
    ///
    /// Explicit ids and repos win over the filter, because naming something is
    /// a narrower request than describing it.
    fn targets(&self, catalogue: &Catalogue) -> Result<Vec<StreamTarget>> {
        let mut out = Vec::new();
        if self.ids.is_empty() && self.repos.is_empty() {
            out.extend(
                catalogue
                    .datasets(&self.filter)
                    .into_iter()
                    .filter_map(StreamTarget::from_dataset),
            );
        } else {
            for id in &self.ids {
                if let Some(t) = StreamTarget::from_dataset(catalogue.require(id)?) {
                    out.push(t);
                }
            }
            for repo in &self.repos {
                let target = catalogue
                    .by_hf_repo(repo)
                    .and_then(StreamTarget::from_dataset)
                    .unwrap_or_else(|| StreamTarget::from_repo(repo));
                out.push(target);
            }
        }
        if let Some(max) = self.max_datasets {
            out.truncate(max);
        }
        Ok(out)
    }

    /// Open the stream. No rows are fetched until it is polled.
    ///
    /// Fails with [`NganoError::NoDatasets`] when nothing selectable matched.
    pub async fn stream(self) -> Result<RowStream> {
        let catalogue = self.resolved_catalogue()?;
        let field_map = match &self.field_map {
            Some(f) => f.clone(),
            None => FieldMap::bundled()?,
        };
        let targets = self.targets(&catalogue)?;
        if targets.is_empty() {
            return Err(NganoError::NoDatasets(describe(
                &self.filter,
                &self.ids,
                &self.repos,
            )));
        }

        let client = HfClient::new(
            &self.base,
            self.token.clone(),
            self.max_retries,
            self.backoff,
        )?;
        let index = catalogue.country_index();
        let field_map = Arc::new(field_map);

        let mut streams: Vec<BoxStream<'static, Result<Row>>> = Vec::with_capacity(targets.len());
        let mut weights = Vec::with_capacity(targets.len());
        for target in targets {
            weights.push(target.weight);
            streams.push(Box::pin(dataset_stream(
                client.clone(),
                Arc::clone(&field_map),
                Arc::clone(&index),
                target,
                self.split.clone(),
                self.config.clone(),
                self.page_size,
            )));
        }

        Ok(RowStream::interleaved(
            streams,
            weights,
            self.interleave,
            self.limit,
        ))
    }

    /// A blocking loader over the same configuration.
    ///
    /// Available with the `blocking` feature.
    #[cfg(feature = "blocking")]
    #[cfg_attr(docsrs, doc(cfg(feature = "blocking")))]
    pub fn blocking(self) -> Result<crate::blocking::BlockingLoader> {
        crate::blocking::BlockingLoader::new(self)
    }
}

/// Describe a selection that matched nothing, for the error message.
fn describe(filter: &Filter, ids: &[String], repos: &[String]) -> String {
    if !ids.is_empty() || !repos.is_empty() {
        let mut named: Vec<&str> = ids.iter().map(String::as_str).collect();
        named.extend(repos.iter().map(String::as_str));
        return format!("named {}", named.join(", "));
    }
    if filter.is_empty() {
        return "empty filter over datasets with a hugging face repo".to_string();
    }
    format!("{filter:?}")
}

/// One thing to stream: a catalogue record, or a bare Hugging Face repo.
#[derive(Debug, Clone)]
struct StreamTarget {
    dataset_id: Option<String>,
    repo: String,
    licence: String,
    source_url: String,
    language: Option<String>,
    language_iso: Option<String>,
    language_tag: Option<String>,
    country: Option<String>,
    domain: Option<String>,
    weight: f64,
}

impl StreamTarget {
    /// A target from a catalogue record, or `None` when it has no repo to stream.
    fn from_dataset(d: &Dataset) -> Option<Self> {
        let repo = d.hf_repo.clone().filter(|r| !r.is_empty())?;
        Some(Self {
            dataset_id: Some(d.id.clone()),
            source_url: d
                .url
                .clone()
                .unwrap_or_else(|| format!("https://huggingface.co/datasets/{repo}")),
            repo,
            licence: d.licence.clone(),
            language: only(&d.languages_clean)
                .or_else(|| only(&d.languages))
                .or_else(|| canonical_name(&d.language_tags)),
            language_iso: only(&d.language_codes).or_else(|| only(&d.iso)),
            language_tag: only(&d.language_tags),
            country: only(&d.country_codes),
            domain: Some(d.domain.clone()).filter(|v| !v.is_empty()),
            weight: d.countable_hours().unwrap_or(1.0).max(1.0),
        })
    }

    /// A target for a repo the catalogue does not list.
    fn from_repo(repo: &str) -> Self {
        let repo = repo.trim().to_string();
        Self {
            source_url: format!("https://huggingface.co/datasets/{repo}"),
            dataset_id: None,
            repo,
            licence: "Unstated".to_string(),
            language: None,
            language_iso: None,
            language_tag: None,
            country: None,
            domain: None,
            weight: 1.0,
        }
    }
}

/// The registry name of a single language tag, used when the record gives no
/// canonical name of its own.
fn canonical_name(tags: &[String]) -> Option<String> {
    let tag = only(tags)?;
    crate::language::LanguageRegistry::shared()
        .get(&tag)
        .map(|c| c.name.clone())
}

/// The single element of a list, when there is exactly one.
fn only(values: &[String]) -> Option<String> {
    match values {
        [one] => Some(one.clone()),
        _ => None,
    }
}

/// Per-split paging state for one dataset.
struct SplitCursor {
    split: SplitRef,
    offset: usize,
    total: Option<u64>,
    map: Option<ColumnMap>,
    ctx: RowContext,
}

/// Everything one dataset's stream needs between polls.
struct DatasetState {
    client: HfClient,
    field_map: Arc<FieldMap>,
    index: Arc<CatalogueInner>,
    target: StreamTarget,
    want_split: Option<String>,
    want_config: Option<String>,
    page_size: usize,
    pending_splits: Option<VecDeque<SplitRef>>,
    current: Option<SplitCursor>,
    buffer: VecDeque<Row>,
    finished: bool,
}

impl DatasetState {
    /// Build the mapping context for one split.
    fn context(&self, split: &SplitRef) -> RowContext {
        RowContext {
            dataset_id: self.target.dataset_id.clone(),
            hf_repo: self.target.repo.clone(),
            licence: self.target.licence.clone(),
            source_url: self.target.source_url.clone(),
            split: split.split.clone(),
            default_language: self.target.language.clone(),
            default_language_iso: self.target.language_iso.clone(),
            default_language_tag: self.target.language_tag.clone(),
            default_country: self.target.country.clone(),
            default_domain: self.target.domain.clone(),
            catalogue: Some(Arc::clone(&self.index)),
            fetcher: Some(self.client.http().clone()),
        }
    }

    /// Do the next unit of work. `Ok(false)` means the dataset is exhausted.
    async fn advance(&mut self) -> Result<bool> {
        if self.pending_splits.is_none() {
            let all = self.client.splits(&self.target.repo).await?;
            let kept: VecDeque<SplitRef> = all
                .into_iter()
                .filter(|s| {
                    self.want_split
                        .as_ref()
                        .is_none_or(|w| s.split.eq_ignore_ascii_case(w))
                        && self
                            .want_config
                            .as_ref()
                            .is_none_or(|w| s.config.eq_ignore_ascii_case(w))
                })
                .collect();
            self.pending_splits = Some(kept);
            return Ok(true);
        }

        if self.current.is_none() {
            let next = self.pending_splits.as_mut().and_then(VecDeque::pop_front);
            let Some(split) = next else {
                return Ok(false);
            };
            let ctx = self.context(&split);
            self.current = Some(SplitCursor {
                split,
                offset: 0,
                total: None,
                map: None,
                ctx,
            });
            return Ok(true);
        }

        let cursor = self.current.as_mut().expect("cursor present");
        if cursor.total.is_some_and(|t| cursor.offset as u64 >= t) {
            self.current = None;
            return Ok(true);
        }

        let page = self
            .client
            .rows(
                &self.target.repo,
                &cursor.split,
                cursor.offset,
                self.page_size,
            )
            .await?;

        if cursor.map.is_none() {
            let mut columns = page.columns.clone();
            if columns.is_empty() {
                columns = self
                    .client
                    .columns(&self.target.repo, &cursor.split.config)
                    .await
                    .unwrap_or_default();
            }
            cursor.map = Some(self.field_map.resolve(Some(&self.target.repo), &columns));
        }
        let map = cursor.map.as_ref().expect("map resolved");

        cursor.total = page.total.or(cursor.total);
        let fetched = page.rows.len();
        for source in &page.rows {
            self.buffer.push_back(map.apply(source, &cursor.ctx));
        }
        cursor.offset += fetched;
        if fetched == 0 || cursor.total.is_some_and(|t| cursor.offset as u64 >= t) {
            self.current = None;
        }
        Ok(true)
    }
}

/// Build the lazily paging stream for one dataset.
fn dataset_stream(
    client: HfClient,
    field_map: Arc<FieldMap>,
    index: Arc<CatalogueInner>,
    target: StreamTarget,
    want_split: Option<String>,
    want_config: Option<String>,
    page_size: usize,
) -> impl Stream<Item = Result<Row>> + Send {
    let state = DatasetState {
        client,
        field_map,
        index,
        target,
        want_split,
        want_config,
        page_size,
        pending_splits: None,
        current: None,
        buffer: VecDeque::new(),
        finished: false,
    };
    futures::stream::unfold(state, |mut state| async move {
        loop {
            if let Some(row) = state.buffer.pop_front() {
                return Some((Ok(row), state));
            }
            if state.finished {
                return None;
            }
            match state.advance().await {
                Ok(true) => continue,
                Ok(false) => return None,
                Err(e) => {
                    state.finished = true;
                    return Some((Err(e), state));
                }
            }
        }
    })
}

/// A stream of canonical rows across one or more datasets.
///
/// Dropping the stream cancels every request in flight. At most one page per
/// dataset is ever held in memory.
pub struct RowStream {
    streams: Vec<BoxStream<'static, Result<Row>>>,
    weights: Vec<f64>,
    credits: Vec<f64>,
    done: Vec<bool>,
    mode: Interleave,
    cursor: usize,
    limit: Option<usize>,
    emitted: usize,
    credits_advanced: bool,
}

impl std::fmt::Debug for RowStream {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RowStream")
            .field("datasets", &self.streams.len())
            .field("mode", &self.mode)
            .field("limit", &self.limit)
            .field("emitted", &self.emitted)
            .finish()
    }
}

impl RowStream {
    /// Combine ready-made row streams under one interleaving policy.
    ///
    /// `weights` must have the same length as `streams`, and is only consulted
    /// by [`Interleave::WeightedByHours`]. Non-positive weights become 1.
    pub fn interleaved(
        streams: Vec<BoxStream<'static, Result<Row>>>,
        weights: Vec<f64>,
        mode: Interleave,
        limit: Option<usize>,
    ) -> Self {
        let n = streams.len();
        let mut weights = weights;
        weights.resize(n, 1.0);
        for w in &mut weights {
            if !w.is_finite() || *w <= 0.0 {
                *w = 1.0;
            }
        }
        Self {
            streams,
            weights,
            credits: vec![0.0; n],
            done: vec![false; n],
            mode,
            cursor: 0,
            limit,
            emitted: 0,
            credits_advanced: false,
        }
    }

    /// How many rows this stream has yielded.
    pub fn emitted(&self) -> usize {
        self.emitted
    }

    /// How many datasets are being read from.
    pub fn datasets(&self) -> usize {
        self.streams.len()
    }

    /// Which stream to take the next row from, or `None` when all are done.
    ///
    /// Exactly one stream is polled per row, which is what makes the
    /// interleaving order deterministic.
    fn next_source(&mut self) -> Option<usize> {
        let live: Vec<usize> = (0..self.streams.len()).filter(|i| !self.done[*i]).collect();
        if live.is_empty() {
            return None;
        }
        match self.mode {
            Interleave::Sequential => Some(live[0]),
            Interleave::RoundRobin => {
                let n = self.streams.len();
                (0..n)
                    .map(|step| (self.cursor + step) % n)
                    .find(|i| !self.done[*i])
            }
            Interleave::WeightedByHours => {
                if !self.credits_advanced {
                    for i in &live {
                        self.credits[*i] += self.weights[*i];
                    }
                    self.credits_advanced = true;
                }
                live.into_iter().reduce(|a, b| {
                    if self.credits[b] > self.credits[a] {
                        b
                    } else {
                        a
                    }
                })
            }
        }
    }

    /// Record that stream `i` produced an item.
    fn on_emit(&mut self, i: usize) {
        match self.mode {
            Interleave::Sequential => {}
            Interleave::RoundRobin => {
                self.cursor = (i + 1) % self.streams.len().max(1);
            }
            Interleave::WeightedByHours => {
                let total: f64 = (0..self.streams.len())
                    .filter(|j| !self.done[*j])
                    .map(|j| self.weights[j])
                    .sum();
                self.credits[i] -= total;
                self.credits_advanced = false;
            }
        }
    }
}

impl Stream for RowStream {
    type Item = Result<Row>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.get_mut();
        if this.limit.is_some_and(|l| this.emitted >= l) {
            return Poll::Ready(None);
        }
        loop {
            let Some(i) = this.next_source() else {
                return Poll::Ready(None);
            };
            match this.streams[i].as_mut().poll_next(cx) {
                Poll::Ready(Some(Ok(row))) => {
                    this.on_emit(i);
                    this.emitted += 1;
                    return Poll::Ready(Some(Ok(row)));
                }
                Poll::Ready(Some(Err(e))) => {
                    this.on_emit(i);
                    return Poll::Ready(Some(Err(e)));
                }
                Poll::Ready(None) => this.done[i] = true,
                Poll::Pending => return Poll::Pending,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// A catalogue record with the language fields under test and defaults for
    /// everything else.
    fn record(languages_clean: &[&str], tags: &[&str], codes: &[&str]) -> Dataset {
        serde_json::from_value(json!({
            "id": "fixture",
            "name": "Fixture",
            "task": "ASR",
            "variety": "Indigenous",
            "languages": [],
            "languages_clean": languages_clean,
            "iso": [],
            "language_tags": tags,
            "language_codes": codes,
            "countries": [],
            "country_codes": ["ZW"],
            "regions": [],
            "quality": "Standard (16 kHz)",
            "labelled": "Transcribed",
            "domain": "Read speech",
            "licence": "CC-BY-4.0",
            "licence_class": "Attribution (CC-BY)",
            "commercial": "Yes",
            "access": "Open",
            "host": "HuggingFace",
            "hf_repo": "org/repo",
            "notes": ""
        }))
        .expect("fixture record")
    }

    #[test]
    fn a_single_language_record_supplies_the_tag_and_the_bare_code() {
        let target =
            StreamTarget::from_dataset(&record(&["Shona"], &["sna"], &["sna"])).expect("target");
        assert_eq!(target.language.as_deref(), Some("Shona"));
        assert_eq!(target.language_iso.as_deref(), Some("sna"));
        assert_eq!(target.language_tag.as_deref(), Some("sna"));
    }

    #[test]
    fn a_record_without_a_clean_name_falls_back_to_the_registry_name() {
        let target =
            StreamTarget::from_dataset(&record(&[], &["eng-NG"], &["eng"])).expect("target");
        assert_eq!(target.language.as_deref(), Some("English (Nigeria)"));
        assert_eq!(target.language_iso.as_deref(), Some("eng"));
        assert_eq!(target.language_tag.as_deref(), Some("eng-NG"));
    }

    #[test]
    fn a_multilingual_record_states_no_single_language() {
        let target = StreamTarget::from_dataset(&record(
            &["Shona", "isiZulu"],
            &["sna", "zul"],
            &["sna", "zul"],
        ))
        .expect("target");
        assert_eq!(target.language, None);
        assert_eq!(target.language_iso, None);
        assert_eq!(target.language_tag, None);
    }

    #[test]
    fn several_tags_sharing_one_code_still_give_that_code() {
        let target =
            StreamTarget::from_dataset(&record(&[], &["eng", "eng-NG"], &["eng"])).expect("target");
        assert_eq!(target.language_tag, None, "two tags is not one language");
        assert_eq!(target.language_iso.as_deref(), Some("eng"));
    }
}
