const NOTIFY_EVENT = 'app:notify';

export function notify({ type = 'info', message = '', duration = 3200 }) {
  if (typeof window === 'undefined') return;
  const text = String(message || '').trim();
  if (!text) return;

  window.dispatchEvent(
    new CustomEvent(NOTIFY_EVENT, {
      detail: {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type,
        message: text,
        duration,
      },
    }),
  );
}

export function notifySuccess(message, duration) {
  notify({ type: 'success', message, duration });
}

export function notifyError(message, duration) {
  notify({ type: 'error', message, duration });
}

export function notifyInfo(message, duration) {
  notify({ type: 'info', message, duration });
}

export function notifyWarning(message, duration) {
  notify({ type: 'warning', message, duration });
}

export const notifyEventName = NOTIFY_EVENT;
