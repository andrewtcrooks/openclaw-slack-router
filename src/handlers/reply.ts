export function resolveThreadTs(event: {
  ts?: string;
  thread_ts?: string;
}): string {
  return event.thread_ts ?? event.ts!;
}
