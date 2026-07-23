"use client";

import { useEffect } from "react";

export function GlobalLogger() {
  useEffect(() => {
    const logError = async (errorInfo: any) => {
      try {
        await fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(errorInfo)
        });
      } catch (e) {
        console.error("Failed to log error to backend", e);
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      logError({
        type: "window_error",
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        url: window.location.href,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError({
        type: "unhandled_rejection",
        message: typeof event.reason === 'string' ? event.reason : (event.reason?.message || "Unknown rejection"),
        stack: event.reason?.stack,
        url: window.location.href,
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
