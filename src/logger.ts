const shouldLogInfo = import.meta.env?.DEV === true;

export function logInfo(...args: unknown[]): void {
  if (shouldLogInfo) {
    console.info(...args);
  }
}

export function logError(...args: unknown[]): void {
  console.error(...args);
}
