export type AutosaveTimer<TTimerHandle> = {
  readonly clearTimeout: (timerHandle: TTimerHandle) => void;
  readonly setTimeout: (
    callback: () => void,
    delayMs: number,
  ) => TTimerHandle;
};

export type AutosaveSaveEvent = {
  readonly content: string;
  readonly sessionId: string;
};

export type AutosaveControllerOptions<TTimerHandle> = {
  readonly debounceMs: number;
  readonly initialSessionId: string;
  readonly save: (event: AutosaveSaveEvent) => void;
  readonly timer: AutosaveTimer<TTimerHandle>;
};

export type AutosaveController = {
  readonly cancel: () => void;
  readonly dispose: () => void;
  readonly schedule: (content: string) => void;
  readonly switchSession: (sessionId: string) => void;
};

type PendingTimer<TTimerHandle> = {
  readonly handle: TTimerHandle;
};

export function createAutosaveController<TTimerHandle>(
  options: AutosaveControllerOptions<TTimerHandle>,
): AutosaveController {
  let activeSessionId = options.initialSessionId;
  let disposed = false;
  let pendingTimer: PendingTimer<TTimerHandle> | undefined;
  let scheduleGeneration = 0;

  const cancel = (): void => {
    const pending = pendingTimer;
    if (pending === undefined) {
      return;
    }

    options.timer.clearTimeout(pending.handle);
    pendingTimer = undefined;
    scheduleGeneration += 1;
  };

  const schedule = (content: string): void => {
    if (disposed) {
      return;
    }

    cancel();
    const capturedSessionId = activeSessionId;
    const capturedGeneration = scheduleGeneration;
    const handle = options.timer.setTimeout(() => {
      if (
        disposed ||
        capturedSessionId !== activeSessionId ||
        capturedGeneration !== scheduleGeneration
      ) {
        return;
      }

      pendingTimer = undefined;
      options.save({ content, sessionId: capturedSessionId });
    }, options.debounceMs);
    pendingTimer = { handle };
  };

  const switchSession = (sessionId: string): void => {
    if (disposed) {
      return;
    }

    cancel();
    activeSessionId = sessionId;
  };

  const dispose = (): void => {
    if (disposed) {
      return;
    }

    cancel();
    disposed = true;
  };

  return { cancel, dispose, schedule, switchSession };
}
