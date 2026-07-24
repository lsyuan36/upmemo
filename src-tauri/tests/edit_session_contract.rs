use std::collections::HashSet;

use upmemo::edit_session::{AutosaveOutcome, EditSessionState, MemoId};

#[test]
fn backend_issued_token_is_independent_from_memo_id() {
    // Given
    let memo_id = MemoId::new();
    let memo_uuid = memo_id.as_uuid();

    // When
    let tokens = (0..100)
        .map(|_| {
            EditSessionState::new(memo_id.clone(), String::new())
                .active_session()
                .token()
                .as_uuid()
        })
        .collect::<HashSet<_>>();

    // Then
    assert_eq!(tokens.len(), 100);
    assert!(!tokens.contains(&memo_uuid));
}

#[test]
fn same_second_memo_ids_are_unique() {
    // Given
    let ids = (0..100)
        .map(|_| MemoId::new().as_uuid())
        .collect::<HashSet<_>>();

    // When
    let unique_count = ids.len();

    // Then
    assert_eq!(unique_count, 100);
}

#[test]
fn current_edit_session_accepts_autosave() {
    // Given
    let mut state = EditSessionState::new(MemoId::new(), String::new());
    let token = state.active_session().token().clone();

    // When
    let outcome = state.autosave(&token, "current content".to_string());

    // Then
    assert_eq!(outcome, AutosaveOutcome::Saved);
    assert_eq!(state.persisted_content(), "current content");
}

#[test]
fn stale_edit_session_rejects_old_autosave() {
    // Given
    let mut state = EditSessionState::new(MemoId::new(), "old content".to_string());
    let dispatched_token = state.active_session().token().clone();
    state.switch_session(MemoId::new(), "new session content".to_string());

    // When
    let outcome = state.autosave(&dispatched_token, "old session content".to_string());

    // Then
    println!(
        "outcome={outcome:?} persisted_content={}",
        state.persisted_content()
    );
    assert_eq!(outcome, AutosaveOutcome::Stale);
    assert_eq!(state.persisted_content(), "new session content");
}

#[test]
fn blank_stale_autosave_cannot_erase_new_session() {
    // Given
    let mut state = EditSessionState::new(MemoId::new(), "old content".to_string());
    let stale_token = state.active_session().token().clone();
    state.switch_session(MemoId::new(), "new session content".to_string());

    // When
    let outcome = state.autosave(&stale_token, String::new());

    // Then
    assert_eq!(outcome, AutosaveOutcome::Stale);
    assert_eq!(state.persisted_content(), "new session content");
}

#[test]
fn history_switch_rejects_previous_session_autosave() {
    // Given
    let mut state = EditSessionState::new(MemoId::new(), "old content".to_string());
    let stale_token = state.active_session().token().clone();
    state.switch_session(MemoId::new(), "restored history".to_string());

    // When
    let outcome = state.autosave(&stale_token, "old current draft".to_string());

    // Then
    assert_eq!(outcome, AutosaveOutcome::Stale);
    assert_eq!(state.persisted_content(), "restored history");
}
