import { AppContainer } from "./AppContainer.js";

export interface AppProps {
  cwd: string;
  config?: string;
}

export function App(props: AppProps) {
  return <AppContainer cwd={props.cwd} config={props.config} />;
}
