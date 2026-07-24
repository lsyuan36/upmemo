use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier};
use std::thread;

use upmemo::memo_store::{
    AtomicFileCommit, CommitAdapter, CommitError, MemoCollection, MemoStoreRepository,
};
use upmemo::models::MemoEntry;

#[derive(Debug)]
struct CountingCommit {
    commits: Arc<AtomicUsize>,
    inner: AtomicFileCommit,
}

impl CommitAdapter for CountingCommit {
    fn commit(&self, target: &Path, bytes: &[u8]) -> Result<(), CommitError> {
        self.inner.commit(target, bytes)?;
        self.commits.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
}

#[test]
fn collection_move_updates_both_collections_with_one_commit() {
    // Given
    let directory = tempfile::tempdir().expect("temp directory must be created");
    let path = directory.path().join("memo_store.json");
    let commits = Arc::new(AtomicUsize::new(0));
    let repository = MemoStoreRepository::open_with(
        &path,
        CountingCommit {
            commits: Arc::clone(&commits),
            inner: AtomicFileCommit,
        },
    )
    .expect("fresh store must open");
    repository
        .transact(|store| {
            store.history.push(entry("move-me", 1));
            Ok(())
        })
        .expect("fixture transaction must commit");
    commits.store(0, Ordering::SeqCst);

    // When
    let moved = repository
        .move_entry("move-me", MemoCollection::History, MemoCollection::Trash)
        .expect("collection move must commit");

    // Then
    let store = repository.snapshot().expect("snapshot must succeed");
    assert!(moved);
    assert!(store.history.is_empty());
    assert_eq!(store.trash, vec![entry("move-me", 1)]);
    assert_eq!(commits.load(Ordering::SeqCst), 1);
}

#[test]
fn transaction_enforces_history_and_trash_boundaries() {
    // Given
    let directory = tempfile::tempdir().expect("temp directory must be created");
    let path = directory.path().join("memo_store.json");
    let repository = MemoStoreRepository::open(&path).expect("fresh store must open");

    // When
    repository
        .transact(|store| {
            store.history = (0..101)
                .map(|index| entry(&format!("history-{index}"), index))
                .collect();
            store.trash = (0..51)
                .map(|index| entry(&format!("trash-{index}"), index))
                .collect();
            Ok(())
        })
        .expect("bounded transaction must commit");

    // Then
    let store = repository.snapshot().expect("snapshot must succeed");
    assert_eq!(store.history.len(), 100);
    assert_eq!(store.trash.len(), 50);
    assert_eq!(store.history[99].id, "history-99");
    assert_eq!(store.trash[49].id, "trash-49");
}

#[test]
fn concurrent_transactions_do_not_lose_updates() {
    // Given
    const WORKERS: usize = 24;
    let directory = tempfile::tempdir().expect("temp directory must be created");
    let path = directory.path().join("memo_store.json");
    let repository = Arc::new(MemoStoreRepository::open(&path).expect("fresh store must open"));
    let barrier = Arc::new(Barrier::new(WORKERS));
    let mut workers = Vec::with_capacity(WORKERS);
    for index in 0..WORKERS {
        let repository = Arc::clone(&repository);
        let barrier = Arc::clone(&barrier);
        workers.push(thread::spawn(move || {
            barrier.wait();
            repository.transact(|store| {
                store.history.push(entry(&format!("memo-{index}"), index));
                Ok(())
            })
        }));
    }

    // When
    for worker in workers {
        worker
            .join()
            .expect("worker must not panic")
            .expect("worker transaction must commit");
    }

    // Then
    let store = repository.snapshot().expect("snapshot must succeed");
    let ids = store
        .history
        .iter()
        .map(|memo| memo.id.as_str())
        .collect::<HashSet<_>>();
    assert_eq!(store.history.len(), WORKERS);
    assert_eq!(ids.len(), WORKERS);
    let disk = std::fs::read(&path).expect("committed store must be readable");
    let parsed: upmemo::memo_store::MemoStoreV2 =
        serde_json::from_slice(&disk).expect("disk store must parse");
    assert_eq!(parsed.history.len(), WORKERS);
}

fn entry(id: &str, timestamp: usize) -> MemoEntry {
    MemoEntry {
        id: id.to_string(),
        content: format!("content-{id}"),
        timestamp: u64::try_from(timestamp).expect("test timestamp must fit u64"),
    }
}
