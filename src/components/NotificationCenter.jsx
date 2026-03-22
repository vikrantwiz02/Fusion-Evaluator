import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { notifyEventName } from '../lib/notify';

const TOAST_STYLES = {
  success: {
    shell: 'bg-white/95 text-emerald-800 border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
    label: 'Success',
  },
  error: {
    shell: 'bg-white/95 text-red-800 border-red-200',
    icon: 'bg-red-100 text-red-700',
    bar: 'bg-red-500',
    label: 'Error',
  },
  warning: {
    shell: 'bg-white/95 text-amber-800 border-amber-200',
    icon: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-500',
    label: 'Warning',
  },
  info: {
    shell: 'bg-white/95 text-sky-800 border-sky-200',
    icon: 'bg-sky-100 text-sky-700',
    bar: 'bg-sky-500',
    label: 'Info',
  },
};

function toastIcon(type) {
  if (type === 'success') return <CheckCircle2 className="w-4 h-4 mt-0.5" />;
  if (type === 'error') return <XCircle className="w-4 h-4 mt-0.5" />;
  if (type === 'warning') return <AlertTriangle className="w-4 h-4 mt-0.5" />;
  return <Info className="w-4 h-4 mt-0.5" />;
}

export default function NotificationCenter() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  useEffect(() => {
    const dismissToast = (id) => {
      setToasts(prev => prev.filter(t => t.id !== id));
      const timer = timersRef.current.get(id);
      if (timer) {
        window.clearTimeout(timer);
        timersRef.current.delete(id);
      }
    };

    const onNotify = (event) => {
      const detail = event?.detail || {};
      if (!detail?.id || !detail?.message) return;

      const toast = {
        id: detail.id,
        type: detail.type || 'info',
        message: String(detail.message),
      };

      setToasts(prev => [...prev, toast]);

      const timeout = window.setTimeout(() => {
        dismissToast(detail.id);
      }, Number.isFinite(detail.duration) ? detail.duration : 3200);

      timersRef.current.set(detail.id, timeout);
    };

    window.addEventListener(notifyEventName, onNotify);

    return () => {
      window.removeEventListener(notifyEventName, onNotify);
      timersRef.current.forEach(timeout => window.clearTimeout(timeout));
      timersRef.current.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[220] flex w-[min(94vw,34rem)] flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        (() => {
          const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
          return (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl border shadow-xl backdrop-blur-md overflow-hidden ${style.shell}`}
        >
          <div className={`h-1 w-full ${style.bar}`} />
          <div className="flex items-start gap-3 px-4 py-3.5">
            <div className={`mt-0.5 rounded-lg p-1.5 ${style.icon}`}>
              {toastIcon(toast.type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{style.label}</p>
              <p className="text-sm font-medium leading-5 break-words">{toast.message}</p>
            </div>
          </div>
        </div>
          );
        })()
      ))}
    </div>
  );
}
