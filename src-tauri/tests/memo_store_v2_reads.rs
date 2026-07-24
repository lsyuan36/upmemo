use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use upmemo::memo_store::{
    AtomicFileCommit, CommitAdapter, CommitError, MemoStoreError, MemoStoreRepository, MemoStoreV2,
};

#[derive(Debug)]
struct AlwaysFailCommit;

impl CommitAdapter for AlwaysFailCommit {
    fn commit(&self, _target: &Path, _bytes: &[u8]) -> Result<(), CommitError> {
        Err(CommitError::Injected("commit interrupted".to_string()))
    }
}

#[derive(Debug)]
struct FailOnceCommit {
    interrupted: AtomicBool,
    inner: AtomicFileCommit,
}

impl CommitAdapter for FailOnceCommit {
    fn commit(&self, target: &Path, bytes: &[u8]) -> Result<(), CommitError> {
        if !self.interrupted.swap(true, Ordering::SeqCst) {
            return Err(CommitError::Injected(
                "first commit interrupted".to_string(),
            ));
        }
        self.inner.commit(target, bytes)
    }
}

#[test]
fn missing_v2_file_yields_explicit_fresh_default() {
    // Given
    let directory = tempfile::tempdir().expect("temp directory must be created");
    let path = directory.path().join("memo_store.json");

    // When
    let repository = MemoStoreRepository::open(&path).expect("missing store must open fresh");

    // Then
    assert_eq!(
        repository.snapshot().expect("snapshot must succeed"),
        MemoStoreV2::default()
    );
    assert!(
        !path.exists(),
        "opening a fresh store must not commit implicitly"
    );
}

#[test]
fn valid_v2_json_round_trip_preserves_all_fields() {
    // Given
    let directory = tempfile::tempdir().expect("temp directory must be created");
    let path = directory.path().join("memo_store.json");
    let expected = fixture_store("round trip");
    fs::write(
        &path,
        serde_json::to_vec_pretty(&expected).expect("fixture must serialize"),
    )
    .expect("fixture must be written");

    // When
    let repository = MemoStoreRepository::open(&path).expect("valid store must open");

    // Then
    assert_eq!(
        repository.snapshot().expect("snapshot must succeed"),
        expected
    );
}

#[test]
fn malformed_existing_v2_returns_typed_error_without_changing_bytes() {
    // Given
    let directory = tempfile::tempdir().expect("temp directory must be created");
    let path = directory.path().join("memo_store.json");
    let malformed = br#"{"version":2,"history":["#;
    fs::write(&path, malformed).expect("malformed fixture must be written");

    // When
    let result = MemoStoreRepository::open(&path);

    // Then
    assert!(matches!(result, Err(MemoStoreError::Malformed { .. })));
    assert_eq!(
        fs::read(&path).expect("fixture must remain readable"),
        malformed
    );
}

#[test]
fn unsupported_existing_version_returns_typed_error() {
    // Given
    let directory = tempfile::tempdir().expect("temp directory must be created");
    let path = directory.path().join("memo_store.json");
    let mut store = fixture_store("future version");
    store.version = 3;
    let bytes = serde_json::to_vec_pretty(&store).expect("fixture must serialize");
    fs::write(&path, &bytes).expect("fixture must be written");

    // When
    let result = MemoStoreRepository::open(&path);

    // Then
    assert!(matches!(
        result,
        Err(MemoStoreError::UnsupportedVersion { found: 3 })
    ));
    assert_eq!(
        fs::read(&path).expect("fixture must remain readable"),
        bytes
    );
}

#[test]
fn atomic_commit_replaces_existing_target_without_temp_artifacts() {
    // Given
    let directory = tempfile::tempdir().expect("temp directory must be created");
    let path = directory.path().join("memo_store.json");
    let old_bytes =
        serde_json::to_vec_pretty(&fixture_store("before")).expect("fixture must serialize");
    fs::write(&path, &old_bytes).expect("fixture must be written");
    let repository = MemoStoreRepository::open(&path).expect("valid store must open");

    // When
    repository
        .transact(|store| {
            store.current_content = "after".to_string();
            Ok(())
        })
        .expect("transaction must commit");

    // Then
    let new_bytes = fs::read(&path).expect("committed store must be readable");
    let parsed: MemoStoreV2 =
        serde_json::from_slice(&new_bytes).expect("committed bytes must be valid JSON");
    assert_ne!(new_bytes, old_bytes);
    assert_eq!(parsed.current_content, "after");
    let files = fs::read_dir(directory.path())
        .expect("store directory must be readable")
        .collect::<Result<Vec<_>, _>>()
        .expect("directory entries must be readable");
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].file_name(), "memo_store.json");
}

#[test]
fn injected_commit_failure_retains_old_disk_and_memory_bytes() {
    // Given
    let directory = tempfile::tempdir().expect("temp directory must be created");
    let path = directory.path().join("memo_store.json");
    let initial = fixture_store("durable old content");
    let old_bytes = serde_json::to_vec_pretty(&initial).expect("fixture must serialize");
    fs::write(&path, &old_bytes).expect("fixture must be written");
    let repository = MemoStoreRepository::open_with(&path, AlwaysFailCommit)
        .expect("valid store must open with injected committer");

    // When
    let result = repository.transact(|store| {
        store.current_content = "must not escape".to_string();
        Ok(())
    });

    // Then
    assert!(matches!(
        result,
        Err(MemoStoreError::Commit(CommitError::Injected(_)))
    ));
    assert_eq!(
        fs::read(&path).expect("old store must remain readable"),
        old_bytes
    );
    assert_eq!(
        repository.snapshot().expect("snapshot must succeed"),
        initial
    );
}

#[test]
fn interrupted_commit_can_retry_without_stale_state_or_temp_files() {
    // Given
    let directory = tempfile::tempdir().expect("temp directory must be created");
    let path = directory.path().join("memo_store.json");
    let initial = fixture_store("before interruption");
    fs::write(
        &path,
        serde_json::to_vec_pretty(&initial).expect("fixture must serialize"),
    )
    .expect("fixture must be written");
    let repository = MemoStoreRepository::open_with(
        &path,
        FailOnceCommit {
            interrupted: AtomicBool::new(false),
            inner: AtomicFileCommit,
        },
    )
    .expect("valid store must open");

    // When
    let interrupted = repository.transact(|store| {
        store.current_content = "interrupted".to_string();
        Ok(())
    });
    repository
        .transact(|store| {
            store.current_content = "retry committed".to_string();
            Ok(())
        })
        .expect("retry must commit");

    // Then
    assert!(matches!(
        interrupted,
        Err(MemoStoreError::Commit(CommitError::Injected(_)))
    ));
    let bytes = fs::read(&path).expect("retried store must be readable");
    let parsed: MemoStoreV2 = serde_json::from_slice(&bytes).expect("retried store must parse");
    assert_eq!(parsed.current_content, "retry committed");
    assert_eq!(
        fs::read_dir(directory.path())
            .expect("store directory must be readable")
            .count(),
        1
    );
}

fn fixture_store(content: &str) -> MemoStoreV2 {
    MemoStoreV2 {
        current_memo_id: Some("memo-1".to_string()),
        current_content: content.to_string(),
        ..MemoStoreV2::default()
    }
}
