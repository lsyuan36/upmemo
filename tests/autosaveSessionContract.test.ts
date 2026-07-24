import assert from "node:assert/strict";
import test from "node:test";
import {
  type AutosaveSaveEvent,
  createAutosaveController,
} from "../src/autosaveController";
import type {
  EditSession,
  EditSessionToken,
  MemoId,
} from "../src/autosaveSessionContract";

type TimerTask = {
  readonly callback: () => void;
  readonly executeAtMs: number;
};

class DeterministicTimer {
  private currentTimeMs = 0;
  private nextTimerId = 1;
  private readonly tasks = new Map<number, TimerTask>();

  constructor(private readonly honorsCancellation: boolean) {}

  setTimeout(callback: () => void, delayMs: number): number {
    const timerId = this.nextTimerId;
    this.nextTimerId += 1;
    this.tasks.set(timerId, {
      callback,
      executeAtMs: this.currentTimeMs + delayMs,
    });
    return timerId;
  }

  clearTimeout(timerId: number): void {
    if (this.honorsCancellation) this.tasks.delete(timerId);
  }

  advanceBy(delayMs: number): void {
    this.currentTimeMs += delayMs;
    const dueTasks = [...this.tasks.entries()].filter(
      ([, task]) => task.executeAtMs <= this.currentTimeMs,
    );

    for (const [timerId, task] of dueTasks) {
      this.tasks.delete(timerId);
      task.callback();
    }
  }
}

class PersistedMemoState {
  constructor(private contentValue: string) {}

  persist(event: AutosaveSaveEvent): void {
    this.contentValue = event.content;
  }

  switchTo(content: string): void {
    this.contentValue = content;
  }

  content(): string {
    return this.contentValue;
  }
}

function memoId(value: string): MemoId {
  return { kind: "memo-id", value };
}

function sessionToken(value: string): EditSessionToken {
  return { kind: "edit-session-token", value };
}

function editSession(memo: string, token: string): EditSession {
  return { memoId: memoId(memo), token: sessionToken(token) };
}

function createHarness(session: EditSession, content: string, honorsCancellation: boolean) {
  const timer = new DeterministicTimer(honorsCancellation);
  const persisted = new PersistedMemoState(content);
  const controller = createAutosaveController({
    debounceMs: 500,
    initialSessionId: session.token.value,
    save: (event) => persisted.persist(event),
    timer,
  });
  return { controller, persisted, timer };
}

test("autosave session baseline persists only the latest active-session draft", () => {
  // Given
  const { controller, persisted, timer } = createHarness(
    editSession("memo-1", "session-1"),
    "",
    true,
  );

  // When
  controller.schedule("first draft");
  timer.advanceBy(499);
  controller.schedule("latest draft");
  timer.advanceBy(500);

  // Then
  assert.equal(persisted.content(), "latest draft");
});

test("autosave session rejects a stale pending timer after creating a new memo", () => {
  // Given
  const nextSession = editSession("memo-2", "session-2");
  const { controller, persisted, timer } = createHarness(
    editSession("memo-1", "session-1"),
    "old",
    false,
  );
  controller.schedule("old memo draft");

  // When
  persisted.switchTo("");
  controller.switchSession(nextSession.token.value);
  timer.advanceBy(500);

  // Then
  assert.equal(persisted.content(), "");
});

test("autosave session rejects a blank stale pending timer", () => {
  // Given
  const nextSession = editSession("memo-2", "session-2");
  const { controller, persisted, timer } = createHarness(
    editSession("memo-1", "session-1"),
    "old",
    false,
  );
  controller.schedule("");

  // When
  persisted.switchTo("new memo content");
  controller.switchSession(nextSession.token.value);
  timer.advanceBy(500);

  // Then
  assert.equal(persisted.content(), "new memo content");
});

test("autosave session rejects an old pending save after loading history", () => {
  // Given
  const historySession = editSession("history-1", "session-2");
  const { controller, persisted, timer } = createHarness(
    editSession("memo-1", "session-1"),
    "old",
    false,
  );
  controller.schedule("old current draft");

  // When
  persisted.switchTo("restored history");
  controller.switchSession(historySession.token.value);
  timer.advanceBy(500);

  // Then
  assert.equal(persisted.content(), "restored history");
});
