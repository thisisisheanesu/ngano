//! Interleaving order and limits, with no HTTP at all.

mod common;

use futures::stream::{self, BoxStream, StreamExt};
use ngano::{Interleave, NganoError, Row, RowStream};

/// A stream of `count` rows tagged with `id`.
fn source(id: &str, count: usize) -> BoxStream<'static, Result<Row, NganoError>> {
    let id = id.to_string();
    stream::iter(
        (0..count)
            .map(move |i| Ok(common::row(&id, &format!("{id}-{i}"))))
            .collect::<Vec<_>>(),
    )
    .boxed()
}

/// Drain a stream into the dataset ids it yielded, in order.
async fn order(mut s: RowStream) -> Vec<String> {
    let mut out = Vec::new();
    while let Some(row) = s.next().await {
        out.push(row.expect("row").dataset_id.unwrap_or_default());
    }
    out
}

#[tokio::test]
async fn round_robin_takes_one_row_from_each_dataset_in_turn() {
    let s = RowStream::interleaved(
        vec![source("a", 3), source("b", 2), source("c", 1)],
        vec![1.0, 1.0, 1.0],
        Interleave::RoundRobin,
        None,
    );
    assert_eq!(order(s).await, ["a", "b", "c", "a", "b", "a"]);
}

#[tokio::test]
async fn sequential_drains_one_dataset_before_the_next() {
    let s = RowStream::interleaved(
        vec![source("a", 3), source("b", 2), source("c", 1)],
        vec![1.0, 1.0, 1.0],
        Interleave::Sequential,
        None,
    );
    assert_eq!(order(s).await, ["a", "a", "a", "b", "b", "c"]);
}

#[tokio::test]
async fn weighted_sampling_follows_the_hours_ratio() {
    let s = RowStream::interleaved(
        vec![source("big", 10), source("small", 10)],
        vec![3.0, 1.0],
        Interleave::WeightedByHours,
        Some(8),
    );
    let seen = order(s).await;
    assert_eq!(
        seen,
        ["big", "big", "small", "big", "big", "big", "small", "big"]
    );
    assert_eq!(seen.iter().filter(|x| *x == "big").count(), 6);
    assert_eq!(seen.iter().filter(|x| *x == "small").count(), 2);
}

#[tokio::test]
async fn weighted_sampling_falls_back_to_equal_weights() {
    let s = RowStream::interleaved(
        vec![source("a", 2), source("b", 2)],
        vec![0.0, f64::NAN],
        Interleave::WeightedByHours,
        None,
    );
    let seen = order(s).await;
    assert_eq!(seen.len(), 4);
    assert_eq!(seen.iter().filter(|x| *x == "a").count(), 2);
}

#[tokio::test]
async fn an_exhausted_dataset_drops_out_of_the_rotation() {
    let s = RowStream::interleaved(
        vec![source("a", 1), source("b", 3)],
        vec![1.0, 1.0],
        Interleave::RoundRobin,
        None,
    );
    assert_eq!(order(s).await, ["a", "b", "b", "b"]);
}

#[tokio::test]
async fn the_limit_stops_the_stream_early() {
    let mut s = RowStream::interleaved(
        vec![source("a", 100), source("b", 100)],
        vec![1.0, 1.0],
        Interleave::RoundRobin,
        Some(5),
    );
    let mut n = 0;
    while s.next().await.is_some() {
        n += 1;
    }
    assert_eq!(n, 5);
    assert_eq!(s.emitted(), 5);
}

#[tokio::test]
async fn an_error_is_yielded_without_ending_the_other_datasets() {
    let failing: BoxStream<'static, Result<Row, NganoError>> =
        stream::iter(vec![Err(NganoError::NotFound("boom".to_string()))]).boxed();
    let mut s = RowStream::interleaved(
        vec![failing, source("b", 2)],
        vec![1.0, 1.0],
        Interleave::RoundRobin,
        None,
    );
    assert!(s.next().await.expect("item").is_err());
    let rest: Vec<String> = order(s).await;
    assert_eq!(rest, ["b", "b"]);
}

#[tokio::test]
async fn an_empty_selection_yields_nothing() {
    let s = RowStream::interleaved(Vec::new(), Vec::new(), Interleave::RoundRobin, None);
    assert_eq!(s.datasets(), 0);
    assert!(order(s).await.is_empty());
}
