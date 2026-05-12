import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });

  const tempFilePath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );

  try {
    await writeFile(tempFilePath, content, "utf8");
    await rename(tempFilePath, filePath);
  } catch (error) {
    await rm(tempFilePath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function quarantineCorruptFile(filePath: string): Promise<string> {
  const corruptDirectory = path.join(path.dirname(filePath), "corrupt");
  await mkdir(corruptDirectory, { recursive: true });

  const quarantinedPath = path.join(
    corruptDirectory,
    `${path.basename(filePath)}.${Date.now()}.${randomBytes(4).toString("hex")}.corrupt`,
  );

  await rename(filePath, quarantinedPath);
  return quarantinedPath;
}
