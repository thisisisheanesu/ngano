//! Synchronous wrappers, behind the `blocking` feature.
//!
//! Each wrapper owns a private current-thread Tokio runtime. Calling one from
//! inside an async runtime will panic, exactly as `tokio` itself does, so use
//! the async API there instead.

use std::future::Future;

use futures::StreamExt;

use crate::error::{NganoError, Result};
use crate::loader::{Loader, RowStream};
use crate::row::Row;

/// Build a private current-thread runtime and drive one future to completion.
pub(crate) fn block_on<T, F>(fut: F) -> Result<T>
where
    F: Future<Output = Result<T>>,
{
    let runtime = new_runtime()?;
    runtime.block_on(fut)
}

/// A current-thread runtime with the IO and timer drivers enabled.
fn new_runtime() -> Result<tokio::runtime::Runtime> {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| NganoError::Runtime(e.to_string()))
}

/// A synchronous loader: same configuration, iterator instead of a stream.
///
/// ```no_run
/// use ngano::{Filter, Loader};
///
/// # fn main() -> Result<(), ngano::NganoError> {
/// let rows = Loader::new()
///     .filter(Filter::new().language("sna"))
///     .limit(Some(10))
///     .blocking()?
///     .rows()?;
///
/// for row in rows {
///     let row = row?;
///     println!("{:?}", row.transcript);
/// }
/// # Ok(()) }
/// ```
#[derive(Debug)]
pub struct BlockingLoader {
    runtime: tokio::runtime::Runtime,
    loader: Loader,
}

impl BlockingLoader {
    /// Wrap a configured [`Loader`].
    pub fn new(loader: Loader) -> Result<Self> {
        Ok(Self {
            runtime: new_runtime()?,
            loader,
        })
    }

    /// Open the stream and expose it as an iterator.
    pub fn rows(self) -> Result<BlockingRows> {
        let stream = self.runtime.block_on(self.loader.stream())?;
        Ok(BlockingRows {
            runtime: self.runtime,
            stream,
        })
    }
}

/// An iterator over canonical rows, backed by a private runtime.
#[derive(Debug)]
pub struct BlockingRows {
    runtime: tokio::runtime::Runtime,
    stream: RowStream,
}

impl BlockingRows {
    /// How many rows have been yielded so far.
    pub fn emitted(&self) -> usize {
        self.stream.emitted()
    }
}

impl Iterator for BlockingRows {
    type Item = Result<Row>;

    fn next(&mut self) -> Option<Self::Item> {
        let stream = &mut self.stream;
        self.runtime.block_on(stream.next())
    }
}
