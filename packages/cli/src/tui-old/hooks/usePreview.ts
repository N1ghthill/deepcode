import { useState, useCallback } from "react";

export interface PreviewFile {
  path: string;
  action: "modify" | "create" | "delete";
  before?: string;
  after?: string;
}

export interface PreviewState {
  open: boolean;
  summary: string;
  files: PreviewFile[];
  selectedIndex: number;
}

const EMPTY: PreviewState = { open: false, summary: "", files: [], selectedIndex: 0 };

export function usePreview() {
  const [state, setState] = useState<PreviewState>(EMPTY);

  const openPreview = useCallback((summary: string, files: PreviewFile[]) => {
    setState({ open: true, summary, files, selectedIndex: 0 });
  }, []);

  const closePreview = useCallback(() => setState(EMPTY), []);

  const selectFile = useCallback((idx: number) => {
    setState((prev) => ({ ...prev, selectedIndex: Math.max(0, Math.min(prev.files.length - 1, idx)) }));
  }, []);

  const nextFile = useCallback(() => {
    setState((prev) => ({ ...prev, selectedIndex: Math.min(prev.files.length - 1, prev.selectedIndex + 1) }));
  }, []);

  const prevFile = useCallback(() => {
    setState((prev) => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
  }, []);

  return { previewState: state, openPreview, closePreview, selectFile, nextFile, prevFile };
}
