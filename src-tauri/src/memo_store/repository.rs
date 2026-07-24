use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use thiserror::Error;

use super::{
    AtomicFileCommit, CommitAdapter, CommitError, MemoCollection, MemoStoreV2, MEMO_STORE_VERSION,
};

pub struct MemoStoreRepository<C = AtomicFileCommit> {
    path: PathBuf,
    state: Mutex<MemoStoreV2>,
    committer: C,
}

#[derive(Debug, Error)]
#[non_exhaustive]
pub enum MemoStoreError {
    #[error("failed to read memo store {path}: {source}")]
    Read {
        path: PathBuf,
        #[source]
        source: io::Error,
    },
    #[error("memo store {path} is malformed: {source}")]
    Malformed {
        path: PathBuf,
        #[source]
        source: serde_json::Error,
    },
    #[error("unsupported memo store version {found}; expected {MEMO_STORE_VERSION}")]
    UnsupportedVersion { found: u32 },
    #[error("memo store state mutex is poisoned")]
    Poisoned,
    #[error("cannot move an entry within {collection:?}")]
    SameCollection { collection: MemoCollection },
    #[error("failed to serialize memo store: {0}")]
    Serialize(#[source] serde_json::Error),
    #[error(transparent)]
    Commit(#[from] CommitError),
}

impl MemoStoreRepository<AtomicFileCommit> {
    pub fn open(path: impl Into<PathBuf>) -> Result<Self, MemoStoreError> {
        Self::open_with(path, AtomicFileCommit)
    }
}

impl<C> MemoStoreRepository<C>
where
    C: CommitAdapter,
{
    pub fn open_with(path: impl Into<PathBuf>, committer: C) -> Result<Self, MemoStoreError> {
        let path = path.into();
        let store = read_strict(&path)?;
        Ok(Self {
            path,
            state: Mutex::new(store),
            committer,
        })
    }

    pub fn snapshot(&self) -> Result<MemoStoreV2, MemoStoreError> {
        self.state
            .lock()
            .map(|store| store.clone())
            .map_err(|_| MemoStoreError::Poisoned)
    }

    pub fn transact<R>(
        &self,
        mutation: impl FnOnce(&mut MemoStoreV2) -> Result<R, MemoStoreError>,
    ) -> Result<R, MemoStoreError> {
        let mut current = self.state.lock().map_err(|_| MemoStoreError::Poisoned)?;
        let mut candidate = current.clone();
        let result = mutation(&mut candidate)?;
        candidate.enforce_limits();
        validate_version(&candidate)?;
        let bytes = serde_json::to_vec_pretty(&candidate).map_err(MemoStoreError::Serialize)?;
        self.committer.commit(&self.path, &bytes)?;
        *current = candidate;
        Ok(result)
    }

    pub fn move_entry(
        &self,
        id: &str,
        source: MemoCollection,
        destination: MemoCollection,
    ) -> Result<bool, MemoStoreError> {
        if source == destination {
            return Err(MemoStoreError::SameCollection { collection: source });
        }

        self.transact(|store| {
            let Some(entry) = store.take(id, source) else {
                return Ok(false);
            };
            store.insert_front(entry, destination);
            Ok(true)
        })
    }
}

fn read_strict(path: &Path) -> Result<MemoStoreV2, MemoStoreError> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(source) if source.kind() == io::ErrorKind::NotFound => {
            return Ok(MemoStoreV2::default())
        }
        Err(source) => {
            return Err(MemoStoreError::Read {
                path: path.to_path_buf(),
                source,
            });
        }
    };
    let store = serde_json::from_slice(&bytes).map_err(|source| MemoStoreError::Malformed {
        path: path.to_path_buf(),
        source,
    })?;
    validate_version(&store)?;
    Ok(store)
}

fn validate_version(store: &MemoStoreV2) -> Result<(), MemoStoreError> {
    if store.version == MEMO_STORE_VERSION {
        Ok(())
    } else {
        Err(MemoStoreError::UnsupportedVersion {
            found: store.version,
        })
    }
}
