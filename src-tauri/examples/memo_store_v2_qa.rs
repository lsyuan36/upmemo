use std::error::Error;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use serde::Serialize;
use sha2::{Digest, Sha256};
use upmemo::memo_store::{
    AtomicFileCommit, CommitAdapter, CommitError, MemoCollection, MemoStoreError,
    MemoStoreRepository, MemoStoreV2,
};
use upmemo::models::MemoEntry;

#[derive(Debug)]
struct CountingCommit {
    count: Arc<AtomicUsize>,
    inner: AtomicFileCommit,
}

impl CommitAdapter for CountingCommit {
    fn commit(&self, target: &Path, bytes: &[u8]) -> Result<(), CommitError> {
        self.inner.commit(target, bytes)?;
        self.count.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
}

#[derive(Debug)]
struct InjectedFailure;

impl CommitAdapter for InjectedFailure {
    fn commit(&self, _target: &Path, _bytes: &[u8]) -> Result<(), CommitError> {
        Err(CommitError::Injected("manual QA interruption".to_string()))
    }
}

#[derive(Serialize)]
struct QaReport {
    before_success_sha256: String,
    after_success_sha256: String,
    before_failure_sha256: String,
    after_failure_sha256: String,
    successful_transaction_commits: usize,
    failed_transaction_bytes_unchanged: bool,
    visible_files_after_failure: Vec<String>,
    parsed_data: MemoStoreV2,
    result: &'static str,
}

fn main() -> Result<(), Box<dyn Error>> {
    let directory = tempfile::tempdir()?;
    let path = directory.path().join("memo_store.json");
    let commits = Arc::new(AtomicUsize::new(0));
    let repository = MemoStoreRepository::open_with(
        &path,
        CountingCommit {
            count: Arc::clone(&commits),
            inner: AtomicFileCommit,
        },
    )?;
    repository.transact(|store| {
        store.current_memo_id = Some("memo-current".to_string());
        store.current_content = "current content".to_string();
        store.history.push(entry("move-me", 1));
        Ok(())
    })?;
    let before_success = fs::read(&path)?;
    commits.store(0, Ordering::SeqCst);

    let moved = repository.move_entry("move-me", MemoCollection::History, MemoCollection::Trash)?;
    let after_success = fs::read(&path)?;
    let successful_transaction_commits = commits.load(Ordering::SeqCst);

    let failing_repository = MemoStoreRepository::open_with(&path, InjectedFailure)?;
    let before_failure = fs::read(&path)?;
    let failure = failing_repository.transact(|store| {
        store.current_content = "must not commit".to_string();
        Ok(())
    });
    let after_failure = fs::read(&path)?;
    let parsed_data: MemoStoreV2 = serde_json::from_slice(&after_failure)?;
    let visible_files_after_failure = fs::read_dir(directory.path())?
        .map(|entry| entry.map(|value| value.file_name().to_string_lossy().into_owned()))
        .collect::<Result<Vec<_>, _>>()?;

    let passed = moved
        && before_success != after_success
        && successful_transaction_commits == 1
        && matches!(
            failure,
            Err(MemoStoreError::Commit(CommitError::Injected(_)))
        )
        && before_failure == after_failure
        && parsed_data.history.is_empty()
        && parsed_data.trash.len() == 1
        && parsed_data
            .trash
            .first()
            .is_some_and(|entry| entry.id == "move-me")
        && visible_files_after_failure == ["memo_store.json"];

    let report = QaReport {
        before_success_sha256: sha256(&before_success),
        after_success_sha256: sha256(&after_success),
        before_failure_sha256: sha256(&before_failure),
        after_failure_sha256: sha256(&after_failure),
        successful_transaction_commits,
        failed_transaction_bytes_unchanged: before_failure == after_failure,
        visible_files_after_failure,
        parsed_data,
        result: if passed { "PASS" } else { "FAIL" },
    };
    println!("{}", serde_json::to_string_pretty(&report)?);

    if passed {
        Ok(())
    } else {
        Err("manual MemoStoreV2 QA failed".into())
    }
}

fn entry(id: &str, timestamp: u64) -> MemoEntry {
    MemoEntry {
        id: id.to_string(),
        content: format!("content-{id}"),
        timestamp,
    }
}

fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
