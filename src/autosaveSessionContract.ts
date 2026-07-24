export type MemoId = {
  readonly kind: "memo-id";
  readonly value: string;
};

export type EditSessionToken = {
  readonly kind: "edit-session-token";
  readonly value: string;
};

export type EditSession = {
  readonly memoId: MemoId;
  readonly token: EditSessionToken;
};

export type AutosaveDraft = {
  readonly session: EditSession;
  readonly content: string;
};

export type AutosaveOutcome =
  | {
      readonly kind: "saved";
      readonly session: EditSession;
    }
  | {
      readonly kind: "stale";
      readonly session: EditSession;
    };
