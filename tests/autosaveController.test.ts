import assert from "node:assert/strict";
import test from "node:test";
import { createAutosaveController } from "../src/autosaveController";

type TimerTask = {
  readonly callback: () => void;
  readonly executeAtMs: number;
};

class FakeTimer {
  private currentTimeMs = 0;
  private nextTimerId = 1;
  private readonly tasks = new Map<number, TimerTask>();

  public constructor(private readonly honorsCancellation = true) {}

  public setTimeout(callback: () => void, delayMs: number): number {
    const timerId = this.nextTimerId;
    this.nextTimerId += 1;
    this.tasks.set(timerId, {
      callback,
      executeAtMs: this.currentTimeMs + delayMs,
    });
    return timerId;
  }

  public clearTimeout(timerId: number): void {
    if (this.honorsCancellation) {
      this.tasks.delete(timerId);
    }
  }

  public advanceBy(delayMs: number): void {
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

function createLegacyDebounce(
  timer: FakeTimer,
  save: (content: string) => void,
): (content: string) => void {
  let scheduledTimerId: number | undefined;

  return (content) => {
    if (scheduledTimerId !== undefined) {
      timer.clearTimeout(scheduledTimerId);
    }

    scheduledTimerId = timer.setTimeout(() => {
      scheduledTimerId = undefined;
      save(content);
    }, 500);
  };
}

test("autosave baseline: saves only the latest content after the existing 500ms debounce", () => {
  // Given
  const timer = new FakeTimer();
  const savedContent: string[] = [];
  const scheduleSave = createLegacyDebounce(timer, (content) => {
    savedContent.push(content);
  });

  // When
  scheduleSave("first");
  timer.advanceBy(499);
  scheduleSave("latest");
  timer.advanceBy(499);

  // Then
  assert.deepEqual(savedContent, []);
  timer.advanceBy(1);
  assert.deepEqual(savedContent, ["latest"]);
});

type SaveEvent = {
  readonly content: string;
  readonly sessionId: string;
};

function createController(timer: FakeTimer, savedEvents: SaveEvent[]) {
  return createAutosaveController({
    debounceMs: 500,
    initialSessionId: "session-a",
    save: (event) => {
      savedEvents.push(event);
    },
    timer,
  });
}

test("autosave controller: reschedules within 500ms and saves only the latest content", () => {
  // Given
  const timer = new FakeTimer();
  const savedEvents: SaveEvent[] = [];
  const controller = createController(timer, savedEvents);

  // When
  controller.schedule("first");
  timer.advanceBy(499);
  controller.schedule("latest");
  timer.advanceBy(500);

  // Then
  assert.deepEqual(savedEvents, [
    { content: "latest", sessionId: "session-a" },
  ]);
});

test("autosave controller: cancels a pending save", () => {
  // Given
  const timer = new FakeTimer();
  const savedEvents: SaveEvent[] = [];
  const controller = createController(timer, savedEvents);

  // When
  controller.schedule("draft");
  controller.cancel();
  timer.advanceBy(500);

  // Then
  assert.deepEqual(savedEvents, []);
});

test("autosave controller: switches sessions without saving pending previous-session content", () => {
  // Given
  const timer = new FakeTimer();
  const savedEvents: SaveEvent[] = [];
  const controller = createController(timer, savedEvents);

  // When
  controller.schedule("old session draft");
  controller.switchSession("session-b");
  timer.advanceBy(500);
  controller.schedule("new session draft");
  timer.advanceBy(500);

  // Then
  assert.deepEqual(savedEvents, [
    { content: "new session draft", sessionId: "session-b" },
  ]);
});

test("autosave controller: ignores a stale callback delivered after switching sessions", () => {
  // Given
  const timer = new FakeTimer(false);
  const savedEvents: SaveEvent[] = [];
  const controller = createController(timer, savedEvents);

  // When
  controller.schedule("old session draft");
  controller.switchSession("session-b");
  timer.advanceBy(500);

  // Then
  assert.deepEqual(savedEvents, []);
});

test("autosave controller: prevents pending and future saves after disposal", () => {
  // Given
  const timer = new FakeTimer();
  const savedEvents: SaveEvent[] = [];
  const controller = createController(timer, savedEvents);

  // When
  controller.schedule("pending draft");
  controller.dispose();
  controller.schedule("later draft");
  timer.advanceBy(500);

  // Then
  assert.deepEqual(savedEvents, []);
});

test("autosave controller: saves blank content for the active session", () => {
  // Given
  const timer = new FakeTimer();
  const savedEvents: SaveEvent[] = [];
  const controller = createController(timer, savedEvents);

  // When
  controller.schedule("");
  timer.advanceBy(500);

  // Then
  assert.deepEqual(savedEvents, [{ content: "", sessionId: "session-a" }]);
});
