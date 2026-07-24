use uuid::Uuid;

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct MemoId(Uuid);

impl MemoId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn as_uuid(&self) -> Uuid {
        self.0
    }
}

impl Default for MemoId {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EditSessionToken(Uuid);

impl EditSessionToken {
    fn issue(memo_id: &MemoId) -> Self {
        loop {
            let token = Uuid::new_v4();
            if token != memo_id.as_uuid() {
                return Self(token);
            }
        }
    }

    pub fn as_uuid(&self) -> Uuid {
        self.0
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EditSession {
    memo_id: MemoId,
    token: EditSessionToken,
}

impl EditSession {
    fn issue(memo_id: MemoId) -> Self {
        let token = EditSessionToken::issue(&memo_id);
        Self { memo_id, token }
    }

    pub fn memo_id(&self) -> &MemoId {
        &self.memo_id
    }

    pub fn token(&self) -> &EditSessionToken {
        &self.token
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AutosaveOutcome {
    Saved,
    Stale,
}

#[derive(Debug)]
pub struct EditSessionState {
    active_session: EditSession,
    persisted_content: String,
}

impl EditSessionState {
    pub fn new(memo_id: MemoId, persisted_content: String) -> Self {
        Self {
            active_session: EditSession::issue(memo_id),
            persisted_content,
        }
    }

    pub fn active_session(&self) -> &EditSession {
        &self.active_session
    }

    pub fn switch_session(
        &mut self,
        memo_id: MemoId,
        persisted_content: String,
    ) -> EditSessionToken {
        let next_session = EditSession::issue(memo_id);
        let token = next_session.token.clone();
        self.active_session = next_session;
        self.persisted_content = persisted_content;
        token
    }

    pub fn autosave(&mut self, token: &EditSessionToken, content: String) -> AutosaveOutcome {
        if token != self.active_session.token() {
            return AutosaveOutcome::Stale;
        }

        self.persisted_content = content;
        AutosaveOutcome::Saved
    }

    pub fn persisted_content(&self) -> &str {
        &self.persisted_content
    }
}
