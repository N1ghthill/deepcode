import { create } from "zustand";

export type PanelId = "context" | "execution" | "detail";

export interface UIPanelState {
  widthPercent: number;
  collapsed: boolean;
}

export interface UIStoreState {
  panels: Record<PanelId, UIPanelState>;
  activePanel: PanelId;

  setActivePanel: (p: PanelId) => void;
  setPanelWidth: (id: PanelId, pct: number) => void;
  togglePanel: (id: PanelId) => void;
  resizePanel: (direction: "left" | "right") => void;
}

const DEFAULT_PANELS: Record<PanelId, UIPanelState> = {
  context: { widthPercent: 25, collapsed: false },
  execution: { widthPercent: 50, collapsed: false },
  detail: { widthPercent: 25, collapsed: false },
};

const MIN_WIDTH = 15;
const RESIZE_STEP = 5;

export const useUIStore = create<UIStoreState>()((set) => ({
  panels: DEFAULT_PANELS,
  activePanel: "execution",

  setActivePanel: (p) => set({ activePanel: p }),

  setPanelWidth: (id, pct) =>
    set((state) => ({
      panels: {
        ...state.panels,
        [id]: { ...state.panels[id], widthPercent: Math.max(MIN_WIDTH, Math.min(70, pct)) },
      },
    })),

  togglePanel: (id) =>
    set((state) => ({
      panels: {
        ...state.panels,
        [id]: { ...state.panels[id], collapsed: !state.panels[id].collapsed },
      },
    })),

  resizePanel: (direction) =>
    set((state) => {
      const active = state.activePanel;
      const current = state.panels[active].widthPercent;
      const delta = direction === "right" ? RESIZE_STEP : -RESIZE_STEP;
      const next = Math.max(MIN_WIDTH, Math.min(70, current + delta));
      // Adjust the other non-active panels proportionally
      const others = (["context", "execution", "detail"] as PanelId[]).filter((p) => p !== active && !state.panels[p].collapsed);
      const diff = next - current;
      const perOther = others.length > 0 ? -diff / others.length : 0;
      const updated = { ...state.panels };
      updated[active] = { ...updated[active], widthPercent: next };
      for (const o of others) {
        updated[o] = {
          ...updated[o],
          widthPercent: Math.max(MIN_WIDTH, updated[o].widthPercent + perOther),
        };
      }
      return { panels: updated };
    }),
}));
