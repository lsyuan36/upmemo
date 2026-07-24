use upmemo::models::MemoEntry;

#[test]
fn legacy_memo_entry_json_round_trip_preserves_shape() {
    // Given
    let entry = MemoEntry {
        id: "memo-1".to_string(),
        content: "baseline content".to_string(),
        timestamp: 123,
    };

    // When
    let json = serde_json::to_string(&entry).expect("MemoEntry must serialize");
    let round_trip: MemoEntry = serde_json::from_str(&json).expect("MemoEntry must deserialize");

    // Then
    assert_eq!(
        json,
        r#"{"id":"memo-1","content":"baseline content","timestamp":123}"#
    );
    assert_eq!(round_trip.id, entry.id);
    assert_eq!(round_trip.content, entry.content);
    assert_eq!(round_trip.timestamp, entry.timestamp);
}
