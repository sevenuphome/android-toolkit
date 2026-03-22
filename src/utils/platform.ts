import * as path from "path";
import * as fs from "fs";

const isWindows = process.platform === "win32";

export function getExecutableName(base: string): string {
  if (!isWindows) {
    return base;
  }
  if (base === "gradlew") {
    return "gradlew.bat";
  }
  return `${base}.exe`;
}

export function getGradleWrapper(workspaceRoot: string): string | undefined {
  const wrapper = path.join(workspaceRoot, getExecutableName("gradlew"));
  if (fs.existsSync(wrapper)) {
    return wrapper;
  }
  return undefined;
}

export function getAdbPath(sdkPath: string): string {
  return path.join(sdkPath, "platform-tools", getExecutableName("adb"));
}

export function getEmulatorPath(sdkPath: string): string {
  return path.join(sdkPath, "emulator", getExecutableName("emulator"));
}

export function executableExists(execPath: string): boolean {
  try {
    fs.accessSync(execPath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export function getSpawnOptions(
  workspaceRoot: string,
  env?: Record<string, string>
): { cwd: string; shell: boolean; env: NodeJS.ProcessEnv } {
  return {
    cwd: workspaceRoot,
    shell: isWindows,
    env: { ...process.env, ...env },
  };
}
