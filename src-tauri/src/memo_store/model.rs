use serde::{Deserialize, Serialize};

use crate::models::MemoEntry;

pub const MEMO_STORE_VERSION: u32 = 2;
const HISTORY_LIMIT: usize = 100;
const TRASH_LIMIT: usize = 50;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct MemoStoreV2 {
    pub version: u32,
    pub current_memo_id: Option<String>,
    pub current_content: String,
    pub history: Vec<MemoEntry>,
    pub archive: Vec<MemoEntry>,
    pub trash: Vec<MemoEntry>,
}

impl Default for MemoStoreV2 {
    fn default() -> Self {
        Self {
            version: MEMO_STORE_VERSION,
            current_memo_id: None,
            current_content: String::new(),
            history: Vec::new(),
            archive: Vec::new(),
            trash: Vec::new(),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MemoCollection {
    History,
    Archive,
    Trash,
}

impl MemoStoreV2 {
    pub(super) fn enforce_limits(&mut self) {
        self.history.truncate(HISTORY_LIMIT);
        self.trash.truncate(TRASH_LIMIT);
    }

    pub(super) fn take(&mut self, id: &str, collection: MemoCollection) -> Option<MemoEntry> {
        let entries = self.collection_mut(collection);
        let position = entries.iter().position(|entry| entry.id == id)?;
        Some(entries.remove(position))
    }

    pub(super) fn insert_front(&mut self, entry: MemoEntry, collection: MemoCollection) {
        self.collection_mut(collection).insert(0, entry);
    }

    fn collection_mut(&mut self, collection: MemoCollection) -> &mut Vec<MemoEntry> {
        match collection {
            MemoCollection::History => &mut self.history,
            MemoCollection::Archive => &mut self.archive,
            MemoCollection::Trash => &mut self.trash,
        }
    }
}
