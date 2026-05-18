import React from "react";
import { AppContainer } from "./AppContainer.js";

export interface AppProps {
  cwd: string;
  config?: string;
  provider?: string;
  model?: string;
  resumeSessionId?: string;
}

export function App(props: AppProps) {
  return (
    <AppContainer
      cwd={props.cwd}
      config={props.config}
      provider={props.provider}
      model={props.model}
      resumeSessionId={props.resumeSessionId}
    />
  );
}
