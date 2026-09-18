import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Toaster } from "./components/ui.js";
import { useApp } from "./lib/store.js";

export function App() {
  const { ready, error, init } = useApp();
  useEffect(() => {
    void init();
  }, [init]);

  if (!ready) {
    return (
      <div className="h-full grid place-items-center">
        <div className="flex flex-col items-center gap-4 text-muted">
          <div className="h-10 w-10 rounded-full border-2 border-line border-t-accent animate-spin" />
          <p className="text-sm">Waking up Tacit…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full grid place-items-center p-8">
        <div className="max-w-md rounded-2xl border border-danger/30 bg-danger-2 p-6">
          <h1 className="font-display text-2xl mb-2">Tacit couldn't start</h1>
          <p className="text-sm text-ink-2">{error}</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
