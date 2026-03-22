import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { executableExists, getAdbPath } from "./platform";

export interface SdkDetectionResult {
  sdkPath: string | undefined;
  source: string;
}

export function detectSdkPath(
  configuredPath?: string,
  workspaceRoot?: string
): SdkDetectionResult {
  // 1. Extension setting
  if (configuredPath) {
    if (validateSdkPath(configuredPath)) {
      return { sdkPath: configuredPath, source: "extension settings" };
    }
  }

  // 2. ANDROID_HOME
  const androidHome = process.env.ANDROID_HOME;
  if (androidHome && validateSdkPath(androidHome)) {
    return { sdkPath: androidHome, source: "ANDROID_HOME" };
  }

  // 3. ANDROID_SDK_ROOT (deprecated but still common)
  const sdkRoot = process.env.ANDROID_SDK_ROOT;
  if (sdkRoot && validateSdkPath(sdkRoot)) {
    return { sdkPath: sdkRoot, source: "ANDROID_SDK_ROOT" };
  }

  // 4. local.properties in workspace
  if (workspaceRoot) {
    const localProps = readLocalProperties(workspaceRoot);
    if (localProps && validateSdkPath(localProps)) {
      return { sdkPath: localProps, source: "local.properties" };
    }
  }

  // 5. OS-specific defaults
  const defaultPath = getDefaultSdkPath();
  if (defaultPath && validateSdkPath(defaultPath)) {
    return { sdkPath: defaultPath, source: "default location" };
  }

  return { sdkPath: undefined, source: "not found" };
}

export function validateSdkPath(sdkPath: string): boolean {
  const adbPath = getAdbPath(sdkPath);
  return executableExists(adbPath);
}

function readLocalProperties(workspaceRoot: string): string | undefined {
  const localPropsPath = path.join(workspaceRoot, "local.properties");
  try {
    const content = fs.readFileSync(localPropsPath, "utf-8");
    const match = content.match(/^sdk\.dir\s*=\s*(.+)$/m);
    if (match) {
      // local.properties uses escaped backslashes on Windows
      return match[1].trim().replace(/\\\\/g, "\\");
    }
  } catch {
    // File doesn't exist or can't be read
  }
  return undefined;
}

function getDefaultSdkPath(): string | undefined {
  const home = os.homedir();

  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Android", "sdk");
    case "linux":
      return path.join(home, "Android", "Sdk");
    case "win32": {
      const localAppData = process.env.LOCALAPPDATA;
      if (localAppData) {
        return path.join(localAppData, "Android", "Sdk");
      }
      return undefined;
    }
    default:
      return undefined;
  }
}
