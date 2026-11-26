"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const TYPE_STYLES = {
  success: {
    container: "border-emerald-200 bg-white text-emerald-950 shadow-emerald-500/10",
    iconWrap: "bg-emerald-100 text-emerald-600",
    bar: "bg-emerald-500",
    Icon: CheckCircle2,
  },
  error: {
    container: "border-rose-200 bg-white text-rose-950 shadow-rose-500/10",
    iconWrap: "bg-rose-100 text-rose-600",
    bar: "bg-rose-500",
    Icon: AlertCircle,
  },
  info: {
    container: "border-blue-200 bg-white text-slate-900 shadow-blue-500/10",
    iconWrap: "bg-blue-100 text-blue-600",
    bar: "bg-blue-500",
    Icon: Info,
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const addToast = useCallback(
    ({ type = "info", title, message, duration }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ms = duration ?? (type === "error" ? 5000 : 3500);

      setToasts((prev) => [
        ...prev.slice(-4),
        { id, type, title, message },
      ]);

      const timer = setTimeout(() => {
        removeToast(id);
      }, ms);
      timersRef.current.set(id, timer);
      return id;
    },
    [removeToast]
  );

  const api = useMemo(
    () => ({
      show: addToast,
      success: (message, title = "Success") =>
        addToast({ type: "success", title, message }),
      error: (message, title = "Error") =>
        addToast({ type: "error", title, message }),
      info: (message, title = "Notice") =>
        addToast({ type: "info", title, message }),
      dismiss: removeToast,
    }),
    [addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 w-full max-w-sm px-4 sm:px-0 pointer-events-none print:hidden"
      >
        {toasts.map((item) => {
          const cfg = TYPE_STYLES[item.type] || TYPE_STYLES.info;
          const Icon = cfg.Icon;
          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto relative overflow-hidden rounded-xl border p-3.5 shadow-lg backdrop-blur-md transition-all duration-200 ${cfg.container}`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar}`} />
              <div className="flex items-start gap-3 pl-1">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.iconWrap}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  {item.title && (
                    <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
                      {item.title}
                    </p>
                  )}
                  <p className="text-sm font-medium leading-snug break-words">
                    {item.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(item.id)}
                  aria-label="Close notification"
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
