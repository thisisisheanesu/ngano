//! `ngano` is an open catalogue and streaming loader for African-language
//! speech datasets.
//!
//! It ships a snapshot of the catalogue inside the binary, so browsing works
//! with no network at all, and it streams rows from any catalogued dataset that
//! is hosted on Hugging Face, mapping heterogeneous columns onto one canonical
//! schema shared with the Python and JavaScript SDKs.
//!
//! # Browse the catalogue, offline
//!
//! ```
//! use ngano::{Catalogue, Filter};
//!
//! let cat = Catalogue::bundled()?;
//! let hits = cat.datasets(&Filter::new().language("sna").commercial(true).task("ASR"));
//! for d in &hits {
//!     println!("{} ({})", d.name, d.licence);
//! }
//!
//! let stats = cat.stats();
//! println!("{} datasets, {:.0} counted hours", stats.datasets, stats.hours);
//! # Ok::<(), ngano::NganoError>(())
//! ```
//!
//! # Languages
//!
//! A language is a BCP 47 tag whose primary subtag is an ISO 639-3 code, so
//! Shona is `sna`. A region subtag marks a country-specific variety, so
//! Nigerian English is `eng-NG` and Mozambican Portuguese is `por-MZ`.
//! [`Filter::language`] accepts a bare code, a tag or a name, in any case, and
//! [`Catalogue::resolve_language`] shows what a given spelling resolves to. A
//! bare code never picks up a regional variety unless you ask for it with
//! [`Filter::include_varieties`].
//!
//! ```
//! use ngano::{Catalogue, Filter};
//!
//! let cat = Catalogue::bundled()?;
//! assert_eq!(cat.resolve_language("isiZulu"), vec!["zul".to_string()]);
//! let nigerian_english = cat.datasets(&Filter::new().language("eng-NG"));
//! assert!(!nigerian_english.is_empty());
//! # Ok::<(), ngano::NganoError>(())
//! ```
//!
//! # Stream rows
//!
//! ```no_run
//! use futures::TryStreamExt;
//! use ngano::{Filter, Interleave, Loader};
//!
//! # async fn run() -> Result<(), ngano::NganoError> {
//! let mut stream = Loader::new()
//!     .filter(Filter::new().language("sna").country("ZW").commercial(true))
//!     .split("train")
//!     .hf_token(std::env::var("HF_TOKEN").ok())
//!     .interleave(Interleave::RoundRobin)
//!     .limit(Some(1000))
//!     .stream()
//!     .await?;
//!
//! while let Some(row) = stream.try_next().await? {
//!     println!("{:?}", row.transcript.as_deref());
//!     if let Some(audio) = &row.audio {
//!         let bytes = audio.read().await?; // nothing was fetched before this
//!         println!("{} bytes", bytes.len());
//!     }
//! }
//! # Ok(()) }
//! ```
//!
//! # One repo, by name
//!
//! [`Loader::repo`] streams a Hugging Face repo whether or not the catalogue
//! lists it, which is the Rust spelling of `load_dataset("google/fleurs",
//! config="sw_ke")` in the Python SDK.
//!
//! ```no_run
//! # async fn run() -> Result<(), ngano::NganoError> {
//! let stream = ngano::Loader::new()
//!     .repo("google/fleurs")
//!     .config("sw_ke")
//!     .limit(Some(100))
//!     .stream()
//!     .await?;
//! # let _ = stream;
//! # Ok(()) }
//! ```
//!
//! # Hours figures
//!
//! Some sources self-report totals of 20,000 hours or more. Those records carry
//! [`Dataset::unverified_size`] and are excluded from every hours aggregate this
//! crate computes.
//!
//! # Runtime, features and MSRV
//!
//! The async API expects a Tokio runtime, which is what `reqwest` uses for its
//! own timers. Default features give `rustls` TLS; `native-tls` swaps it,
//! `blocking` adds synchronous wrappers, and `cli` builds the `ngano` binary.
//! The minimum supported Rust version is 1.82.

#![deny(missing_docs)]
#![forbid(unsafe_code)]
#![cfg_attr(docsrs, feature(doc_cfg))]

mod catalogue;
mod error;
mod field_map;
mod filter;
mod hf;
mod http;
mod language;
mod loader;
mod model;
mod row;

#[cfg(feature = "blocking")]
#[cfg_attr(docsrs, doc(cfg(feature = "blocking")))]
pub mod blocking;

pub use catalogue::{Catalogue, DEFAULT_API_BASE};
pub use error::{NganoError, Result};
pub use field_map::{normalise_column, Binding, ColumnMap, FieldMap, CANONICAL_FIELDS};
pub use filter::Filter;
pub use hf::{DEFAULT_HF_BASE, MAX_PAGE_ROWS};
pub use language::{canonicalise_tag, LanguageCode, LanguageRegistry};
pub use loader::{Interleave, Loader, RowStream};
pub use model::{Country, Dataset, Language, Stats};
pub use row::{AudioRef, Row};

/// The version of this crate.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// The README examples, compiled and run as doctests.
///
/// The README shows the `blocking` API, so it is checked under
/// `cargo test --features blocking`.
#[cfg(all(doctest, feature = "blocking"))]
#[doc = include_str!("../README.md")]
pub struct ReadmeExamples;
