import { checkForUpdate, isNewer } from "../update-checker.js";
import { VERSION } from "../version.js";
import { writeStdoutLine } from "../stream-flush.js";

export async function updateCommand(): Promise<void> {
  writeStdoutLine(`Current version: ${VERSION}`);

  const update = await checkForUpdate(VERSION, { force: true });

  if (!update) {
    writeStdoutLine("Could not reach the npm registry right now.");
    return;
  }

  const latestNewer = isNewer(VERSION, update.latest);
  writeStdoutLine(
    `Latest version:  ${update.latest} (${latestNewer ? "update available" : "up to date"})`,
  );

  if (update.stable) {
    const stableNewer = isNewer(VERSION, update.stable);
    writeStdoutLine(
      `Stable version:  ${update.stable} (${stableNewer ? "update available" : "up to date"})`,
    );
  } else {
    writeStdoutLine("Stable version:  not published yet");
  }

  if (latestNewer || (update.stable && isNewer(VERSION, update.stable))) {
    writeStdoutLine("");
    writeStdoutLine("Install latest:  npm install -g deepcode-ai@latest");
    writeStdoutLine("Install stable:  npm install -g deepcode-ai@stable");
  }
}
