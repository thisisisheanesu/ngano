//! Stream canonical rows from a filtered slice of the ngano catalogue.
//!
//! ```text
//! cargo run --example stream_rows -- --language Amharic --limit 50
//! cargo run --example stream_rows -- --country ZA --split test --jsonl out.jsonl
//! cargo run --example stream_rows -- --stats
//! ```
//!
//! Catalogue access is offline: every package bundles a snapshot, so searching
//! and counting need no network at all. Rows are a different matter, and they
//! stream. A multi-dataset load interleaves lazily, so `.take(50)` really does
//! stop after fifty rows instead of finishing the download quietly.
//!
//! Gated repos on the Hugging Face Hub need a token:
//!
//! ```text
//! export HF_TOKEN="hf_..."
//! ```
//!
//! Datasets whose `access` is Request, Paid or Scrape required are skipped. A
//! token does not help with those, someone has to ask or pay first.
//!
//! Add to `Cargo.toml`:
//!
//! ```toml
//! [dependencies]
//! ngano = "0.1"
//! anyhow = "1"
//! serde_json = "1"
//! ```

use std::collections::HashSet;
use std::fs::File;
use std::io::{BufWriter, Write};

use ngano::{load, Catalogue, Query};

/// Access values that need a human before any row can be fetched.
const NEEDS_A_HUMAN: [&str; 4] = ["Request", "Paid", "Scrape required", "Unclear"];

struct Options {
    language: Option<String>,
    country: Option<String>,
    region: Option<String>,
    split: String,
    limit: usize,
    jsonl: Option<String>,
    stats: bool,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            language: None,
            country: None,
            region: None,
            split: "train".to_string(),
            limit: 20,
            jsonl: None,
            stats: false,
        }
    }
}

fn parse_args() -> anyhow::Result<Options> {
    let mut options = Options::default();
    let mut args = std::env::args().skip(1);
    while let Some(flag) = args.next() {
        match flag.as_str() {
            "--stats" => options.stats = true,
            "--language" => options.language = args.next(),
            "--country" => options.country = args.next(),
            "--region" => options.region = args.next(),
            "--split" => options.split = args.next().unwrap_or_else(|| "train".into()),
            "--jsonl" => options.jsonl = args.next(),
            "--limit" => {
                let raw = args.next().unwrap_or_default();
                options.limit = raw
                    .parse()
                    .map_err(|_| anyhow::anyhow!("--limit needs a number, got {raw:?}"))?;
            }
            other => anyhow::bail!("unknown option {other}"),
        }
    }
    Ok(options)
}

fn print_stats(catalogue: &Catalogue) {
    let all = catalogue.all();
    let verified: Vec<_> = all.iter().filter(|d| !d.unverified_size).collect();
    let hours: f64 = verified.iter().filter_map(|d| d.hours_num).sum();
    let languages: HashSet<&str> = all
        .iter()
        .flat_map(|d| d.languages_clean.iter().map(String::as_str))
        .collect();
    let countries: HashSet<&str> = all
        .iter()
        .flat_map(|d| d.countries.iter().map(String::as_str))
        .filter(|c| *c != "Pan-African")
        .collect();

    println!("datasets              {}", all.len());
    println!(
        "  flagged unverified  {} (excluded from hours)",
        all.len() - verified.len()
    );
    println!(
        "  with a stated size  {}",
        verified.iter().filter(|d| d.hours_num.is_some()).count()
    );
    println!(
        "  on the Hub          {}",
        all.iter().filter(|d| d.hf_repo.is_some()).count()
    );
    println!("verified hours        {hours:.0}");
    println!("languages             {}", languages.len());
    println!("countries             {}", countries.len());
}

fn main() -> anyhow::Result<()> {
    let options = parse_args()?;
    let catalogue = Catalogue::load()?;

    if options.stats {
        print_stats(&catalogue);
        return Ok(());
    }

    let mut query = Query::new().hf_only(true).sort("-hours");
    if let Some(language) = &options.language {
        query = query.language(language);
    }
    if let Some(country) = &options.country {
        query = query.country(country);
    }
    if let Some(region) = &options.region {
        query = query.region(region);
    }

    let matched = catalogue.search(&query);
    if matched.is_empty() {
        anyhow::bail!("nothing matched that filter on the Hub, see https://ngano.dev");
    }

    let (loadable, blocked): (Vec<_>, Vec<_>) = matched
        .into_iter()
        .partition(|d| !NEEDS_A_HUMAN.contains(&d.access.as_str()));
    for dataset in &blocked {
        eprintln!("skipping {}: access is {}", dataset.id, dataset.access);
    }
    if loadable.is_empty() {
        anyhow::bail!("every match needs a request, a purchase or a scrape");
    }

    let counted: Vec<_> = loadable
        .iter()
        .filter(|d| d.hours_num.is_some() && !d.unverified_size)
        .collect();
    let total: f64 = counted.iter().filter_map(|d| d.hours_num).sum();
    eprintln!(
        "{} dataset(s), {total:.0} verified hours across the {} that state a size",
        loadable.len(),
        counted.len()
    );
    if std::env::var_os("HF_TOKEN").is_none() {
        eprintln!("HF_TOKEN is not set. Gated repos in this selection will fail.");
    }

    let mut writer = match &options.jsonl {
        Some(path) => Some(BufWriter::new(File::create(path)?)),
        None => None,
    };

    let rows = load(&loadable).split(&options.split).rows()?;
    let mut written = 0usize;

    for row in rows.take(options.limit) {
        let row = row?;
        match writer.as_mut() {
            Some(handle) => {
                writeln!(handle, "{}", serde_json::to_string(&row)?)?;
            }
            None => {
                println!(
                    "{:<32} {:>8} {}",
                    row.dataset_id,
                    row.duration_s
                        .map(|d| format!("{d:.2}s"))
                        .unwrap_or_else(|| "unstated".into()),
                    row.transcript.as_deref().unwrap_or("(no transcript)")
                );
            }
        }
        written += 1;
    }

    if let Some(mut handle) = writer {
        handle.flush()?;
        eprintln!(
            "wrote {written} rows to {}",
            options.jsonl.as_deref().unwrap_or("-")
        );
    } else {
        eprintln!("{written} rows");
    }

    Ok(())
}
