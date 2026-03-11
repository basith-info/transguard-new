/**
 * Lightweight in-process event bus for cross-component communication.
 * Use window custom events so any component tree can listen.
 */

export const EVENTS = {
  ATTENDANCE_UPDATED: "sgms:attendance:updated",
} as const;

/** Fire when any attendance record is saved */
export function emitAttendanceUpdated(guardId?: number) {
  window.dispatchEvent(
    new CustomEvent(EVENTS.ATTENDANCE_UPDATED, { detail: { guardId } })
  );
}

/** Subscribe to attendance updates; returns an unsubscribe function */
export function onAttendanceUpdated(
  cb: (guardId?: number) => void
): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    cb(detail?.guardId);
  };
  window.addEventListener(EVENTS.ATTENDANCE_UPDATED, handler);
  return () => window.removeEventListener(EVENTS.ATTENDANCE_UPDATED, handler);
}
