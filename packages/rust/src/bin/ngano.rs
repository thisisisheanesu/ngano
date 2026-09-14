//! Command line interface for the ngano catalogue and loader.

use std::io::Write;
use std::path::PathBuf;

use clap::{Parser, Subcommand, ValueEnum};
use futures::TryStreamExt;
use ngano::{Catalogue, Dataset, Filter, Interleave, Loader, NganoError};

/// Open catalogue and loader for African-language speech datasets.
#[derive(Debug, Parser)]
#[command(name = "ngano", version, about, long_about = None)]
struct Cli {
    /// Print machine readable JSON instead of text.
    #[arg(long, global = true)]
    json: bool,

    /// Fetch the live catalogue from the API instead of the bundled snapshot.
    #[arg(long, global = true)]
    api: bool,

    #[command(subcommand)]
    command: Command,
}

/// Selection options shared by `search` and `load`.
#[derive(Debug, Clone, clap::Args)]
struct Selection {
    /// Language as an ISO 639-3 code, a BCP 47 tag or a name, repeatable.
    /// For example sna, eng-NG or Shona.
    #[arg(long)]
    language: Vec<String>,
    /// Let a bare ISO 639-3 code also match its regional varieties, so eng
    /// keeps eng-NG and eng-ZA too.
    #[arg(long)]
    include_varieties: bool,
    /// Country as an ISO 3166-1 alpha-2 code or a name, repeatable.
    #[arg(long)]
    country: Vec<String>,
    /// Task, for example ASR, repeatable.
    #[arg(long)]
    task: Vec<String>,
    /// Region, repeatable.
    #[arg(long)]
    region: Vec<String>,
    /// Keep only datasets usable commercially.
    #[arg(long)]
    commercial: bool,
    /// Keep only datasets hosted on Hugging Face.
    #[arg(long)]
    hf_only: bool,
    /// Minimum counted hours.
    #[arg(long)]
    min_hours: Option<f64>,
}

impl Selection {
    /// Fold the flags into a [`Filter`].
    fn to_filter(&self, query: Option<&str>) -> Filter {
        let mut f = Filter::new();
        for v in &self.language {
            f = f.language(v);
        }
        if self.include_varieties {
            f = f.include_varieties(true);
        }
        for v in &self.country {
            f = f.country(v);
        }
        for v in &self.task {
            f = f.task(v);
        }
        for v in &self.region {
            f = f.region(v);
        }
        if self.commercial {
            f = f.commercial(true);
        }
        if self.hf_only {
            f = f.hf_only(true);
        }
        if let Some(h) = self.min_hours {
            f = f.min_hours(h);
        }
        if let Some(q) = query {
            f = f.q(q);
        }
        f
    }
}

/// How a multi-dataset load interleaves.
#[derive(Debug, Clone, Copy, ValueEnum)]
enum InterleaveArg {
    /// One row from each dataset in turn.
    RoundRobin,
    /// One dataset fully, then the next.
    Sequential,
    /// In proportion to counted hours.
    WeightedByHours,
}

impl From<InterleaveArg> for Interleave {
    fn from(v: InterleaveArg) -> Self {
        match v {
            InterleaveArg::RoundRobin => Interleave::RoundRobin,
            InterleaveArg::Sequential => Interleave::Sequential,
            InterleaveArg::WeightedByHours => Interleave::WeightedByHours,
        }
    }
}

/// The subcommands.
#[derive(Debug, Subcommand)]
enum Command {
    /// Search the catalogue.
    Search {
        /// Free-text query.
        query: Option<String>,
        #[command(flatten)]
        selection: Selection,
        /// Show at most this many results.
        #[arg(long, default_value_t = 20)]
        limit: usize,
    },
    /// Show one dataset by catalogue id.
    Show {
        /// Catalogue id, for example waxal-corpus-paper.
        id: String,
    },
    /// List countries in the coverage map.
    Countries,
    /// List languages in the coverage map, by BCP 47 tag.
    Languages {
        /// Show only languages whose tag, code or name matches this value.
        #[arg(long)]
        language: Option<String>,
        /// Let a bare ISO 639-3 code also match its regional varieties.
        #[arg(long)]
        include_varieties: bool,
    },
    /// Print catalogue aggregates.
    Stats,
    /// Stream rows and write them as JSON lines.
    Load {
        #[command(flatten)]
        selection: Selection,
        /// Hugging Face repo to stream directly, repeatable. Replaces the filter.
        #[arg(long)]
        repo: Vec<String>,
        /// Dataset config to stream, for example sw_ke.
        #[arg(long)]
        config: Option<String>,
        /// Stop after this many rows.
        #[arg(long, default_value_t = 100)]
        limit: usize,
        /// Write to this file instead of standard output.
        #[arg(long)]
        out: Option<PathBuf>,
        /// Keep only this split.
        #[arg(long)]
        split: Option<String>,
        /// Interleaving policy across datasets.
        #[arg(long, value_enum, default_value_t = InterleaveArg::RoundRobin)]
        interleave: InterleaveArg,
        /// Stream at most this many datasets.
        #[arg(long)]
        max_datasets: Option<usize>,
    },
}

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("ngano: {e}");
        std::process::exit(1);
    }
}

/// Run the parsed command.
async fn run() -> Result<(), NganoError> {
    let cli = Cli::parse();
    let mut out = std::io::stdout().lock();
    let catalogue = if cli.api {
        Catalogue::from_api().await?
    } else {
        Catalogue::bundled()?
    };

    match &cli.command {
        Command::Search {
            query,
            selection,
            limit,
        } => {
            let filter = selection.to_filter(query.as_deref());
            warn_unresolved(&filter);
            let mut hits = catalogue.datasets(&filter);
            hits.truncate(*limit);
            if cli.json {
                writeln!(out, "{}", serde_json::to_string_pretty(&hits)?)?;
            } else if hits.is_empty() {
                writeln!(out, "No datasets matched.")?;
            } else {
                for d in &hits {
                    writeln!(out, "{}", summarise(d))?;
                }
                writeln!(out, "\n{} shown.", hits.len())?;
            }
        }
        Command::Show { id } => {
            let d = catalogue.require(id)?;
            if cli.json {
                writeln!(out, "{}", serde_json::to_string_pretty(d)?)?;
            } else {
                print_dataset(&mut out, d)?;
            }
        }
        Command::Countries => {
            if cli.json {
                writeln!(
                    out,
                    "{}",
                    serde_json::to_string_pretty(catalogue.countries())?
                )?;
            } else {
                for c in catalogue.countries() {
                    writeln!(out, "{}  {:<28} {}", c.iso2, c.name, c.region)?;
                }
            }
        }
        Command::Languages {
            language,
            include_varieties,
        } => {
            let wanted = language.as_deref().map(|value| {
                catalogue
                    .registry()
                    .resolve(value, *include_varieties)
                    .iter()
                    .map(|t| t.to_lowercase())
                    .collect::<Vec<_>>()
            });
            let shown: Vec<&ngano::Language> = catalogue
                .languages()
                .iter()
                .filter(|l| match &wanted {
                    Some(tags) => tags.contains(&l.tag.to_lowercase()),
                    None => true,
                })
                .collect();
            if cli.json {
                writeln!(out, "{}", serde_json::to_string_pretty(&shown)?)?;
            } else if shown.is_empty() {
                writeln!(out, "No languages matched.")?;
            } else {
                for l in &shown {
                    let n = l.datasets.unwrap_or_default();
                    writeln!(
                        out,
                        "{:<10} {:<6} {:<34} {:>4} datasets",
                        l.tag,
                        l.iso639_3,
                        truncate(&l.name, 34),
                        n
                    )?;
                }
                writeln!(
                    out,
                    "\n{} shown. A tag with a region, such as eng-NG, is a country-specific variety.",
                    shown.len()
                )?;
            }
        }
        Command::Stats => {
            let s = catalogue.stats();
            if cli.json {
                writeln!(out, "{}", serde_json::to_string_pretty(&s)?)?;
            } else {
                writeln!(out, "datasets            {}", s.datasets)?;
                writeln!(out, "counted hours       {:.0}", s.hours)?;
                writeln!(out, "unverified records  {}", s.unverified_datasets)?;
                writeln!(out, "streamable          {}", s.streamable_datasets)?;
                writeln!(out, "language tags       {}", s.languages)?;
                writeln!(out, "iso 639-3 codes     {}", s.language_codes)?;
                writeln!(out, "countries           {}", s.countries)?;
                writeln!(out, "\nby task")?;
                for (k, v) in &s.by_task {
                    writeln!(out, "  {k:<20} {v}")?;
                }
                writeln!(out, "\nby access")?;
                for (k, v) in &s.by_access {
                    writeln!(out, "  {k:<20} {v}")?;
                }
                writeln!(
                    out,
                    "\nHours exclude self-reported figures of 20,000 hours or more."
                )?;
            }
        }
        Command::Load {
            selection,
            repo,
            config,
            limit,
            out,
            split,
            interleave,
            max_datasets,
        } => {
            let filter = selection.to_filter(None);
            warn_unresolved(&filter);
            let mut loader = Loader::new()
                .catalogue(catalogue)
                .filter(filter)
                .interleave(Interleave::from(*interleave))
                .limit(Some(*limit))
                .max_datasets(*max_datasets)
                .hf_token(std::env::var("HF_TOKEN").ok());
            for r in repo {
                loader = loader.repo(r);
            }
            if let Some(s) = split {
                loader = loader.split(s);
            }
            if let Some(c) = config {
                loader = loader.config(c);
            }

            let mut sink: Box<dyn Write> = match out {
                Some(path) => Box::new(std::fs::File::create(path)?),
                None => Box::new(std::io::stdout().lock()),
            };
            let mut stream = loader.stream().await?;
            let mut written = 0usize;
            while let Some(row) = stream.try_next().await? {
                writeln!(sink, "{}", serde_json::to_string(&row)?)?;
                written += 1;
            }
            sink.flush()?;
            if let Some(path) = out {
                eprintln!("wrote {written} rows to {}", path.display());
            }
        }
    }
    Ok(())
}

/// Tell the caller when a language spelling resolved to nothing, so that an
/// empty result is not mistaken for an empty catalogue.
fn warn_unresolved(filter: &Filter) {
    let unresolved = filter.unresolved_languages();
    if !unresolved.is_empty() {
        eprintln!(
            "ngano: no language matches {}. Try an ISO 639-3 code such as sna, a tag such as eng-NG, or run: ngano languages",
            unresolved.join(", ")
        );
    }
}

/// One line describing a dataset.
fn summarise(d: &Dataset) -> String {
    let hours = match d.countable_hours() {
        Some(h) => format!("{h:.0} h"),
        None if d.unverified_size => "unverified".to_string(),
        None => "unstated".to_string(),
    };
    format!(
        "{:<40} {:<10} {:<12} {}",
        truncate(&d.id, 40),
        d.task,
        hours,
        d.languages_clean.join(", ")
    )
}

/// The full record, as readable text.
fn print_dataset(out: &mut impl Write, d: &Dataset) -> std::io::Result<()> {
    writeln!(out, "{}", d.name)?;
    writeln!(out, "id            {}", d.id)?;
    writeln!(out, "task          {}", d.task)?;
    writeln!(out, "languages     {}", d.languages_clean.join(", "))?;
    if !d.language_tags.is_empty() {
        writeln!(out, "tags          {}", d.language_tags.join(" "))?;
        writeln!(out, "iso 639-3     {}", d.language_codes.join(" "))?;
    }
    writeln!(out, "countries     {}", d.countries.join(", "))?;
    println!(
        "hours         {}",
        d.hours.clone().unwrap_or_else(|| "unstated".to_string())
    );
    if d.unverified_size {
        writeln!(
            out,
            "              self-reported and unverified, excluded from totals"
        )?;
    }
    writeln!(out, "licence       {} ({})", d.licence, d.licence_class)?;
    writeln!(out, "commercial    {}", d.commercial)?;
    writeln!(out, "access        {}", d.access)?;
    writeln!(out, "quality       {}", d.quality)?;
    writeln!(out, "labelled      {}", d.labelled)?;
    writeln!(out, "host          {}", d.host)?;
    if let Some(repo) = &d.hf_repo {
        writeln!(out, "hf repo       {repo}")?;
    }
    if let Some(url) = &d.url {
        writeln!(out, "url           {url}")?;
    }
    if let Some(note) = &d.language_note {
        writeln!(out, "\nlanguages note: {note}")?;
    }
    if !d.notes.is_empty() {
        writeln!(out, "\n{}", d.notes)?;
    }
    Ok(())
}

/// Shorten a string for column output.
fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    s.chars().take(max.saturating_sub(3)).collect::<String>() + "..."
}
