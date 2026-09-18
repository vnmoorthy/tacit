import { create } from "zustand";
import type { ApiClient, Health } from "./api.js";
import { resolveApi } from "./api.js";

export interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  text: string;
}

interface AppState {
  api: ApiClient | null;
  health: Health | null;
  ready: boolean;
  error: string | null;
  toasts: Toast[];
  init: () => Promise<void>;
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;

export const useApp = create<AppState>((set, get) => ({
  api: null,
  health: null,
  ready: false,
  error: null,
  toasts: [],
  async init() {
    try {
      const { api, health } = await resolveApi();
      set({ api, health, ready: true, error: null });
    } catch (e) {
      set({ error: (e as Error).message, ready: true });
    }
  },
  toast(text, kind = "info") {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    window.setTimeout(() => get().dismiss(id), kind === "error" ? 7000 : 4000);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

/** Convenience: throws if the API isn't ready yet (pages are only rendered once it is). */
export function useApi(): ApiClient {
  const api = useApp((s) => s.api);
  if (!api) throw new Error("API not ready");
  return api;
}
