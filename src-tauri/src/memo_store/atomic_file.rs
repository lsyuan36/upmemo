use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use tempfile::NamedTempFile;
use thiserror::Error;

pub trait CommitAdapter: Send + Sync {
    fn commit(&self, target: &Path, bytes: &[u8]) -> Result<(), CommitError>;
}

#[derive(Clone, Copy, Debug, Default)]
pub struct AtomicFileCommit;

#[derive(Debug, Error)]
#[non_exhaustive]
pub enum CommitError {
    #[error("target path has no parent directory: {target}")]
    MissingParent { target: PathBuf },
    #[error("{operation} failed for {path}: {source}")]
    Io {
        operation: &'static str,
        path: PathBuf,
        #[source]
        source: io::Error,
    },
    #[error("atomic replacement failed for {target}: {source}")]
    Persist {
        target: PathBuf,
        #[source]
        source: io::Error,
    },
    #[error("injected commit failure: {0}")]
    Injected(String),
}

impl CommitAdapter for AtomicFileCommit {
    fn commit(&self, target: &Path, bytes: &[u8]) -> Result<(), CommitError> {
        let parent = target
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .ok_or_else(|| CommitError::MissingParent {
                target: target.to_path_buf(),
            })?;

        fs::create_dir_all(parent).map_err(|source| CommitError::Io {
            operation: "create store directory",
            path: parent.to_path_buf(),
            source,
        })?;
        let mut temporary = NamedTempFile::new_in(parent).map_err(|source| CommitError::Io {
            operation: "create same-directory temporary file",
            path: parent.to_path_buf(),
            source,
        })?;
        temporary
            .write_all(bytes)
            .map_err(|source| CommitError::Io {
                operation: "write temporary store",
                path: temporary.path().to_path_buf(),
                source,
            })?;
        temporary
            .as_file()
            .sync_all()
            .map_err(|source| CommitError::Io {
                operation: "sync temporary store",
                path: temporary.path().to_path_buf(),
                source,
            })?;
        temporary
            .persist(target)
            .map_err(|error| CommitError::Persist {
                target: target.to_path_buf(),
                source: error.error,
            })?;

        #[cfg(unix)]
        fs::File::open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|source| CommitError::Io {
                operation: "sync store directory",
                path: parent.to_path_buf(),
                source,
            })?;

        Ok(())
    }
}
