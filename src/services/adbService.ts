import { execFile } from "child_process";
import { promisify } from "util";
import { AndroidDevice, DeviceState, DeviceType } from "../models/device";
import { normalizeLineEndings } from "../utils/platform";

const execFileAsync = promisify(execFile);

export class AdbService {
  constructor(private adbPath: string) {}

  updateAdbPath(newPath: string): void {
    this.adbPath = newPath;
  }

  async listDevices(): Promise<AndroidDevice[]> {
    const { stdout } = await execFileAsync(this.adbPath, ["devices", "-l"]);
    return parseDeviceList(normalizeLineEndings(stdout));
  }

  async getDeviceProperty(
    serial: string,
    prop: string
  ): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync(this.adbPath, [
        "-s",
        serial,
        "shell",
        "getprop",
        prop,
      ]);
      const value = stdout.trim().replace(/\r/g, "");
      return value || undefined;
    } catch {
      return undefined;
    }
  }

  async installApk(
    serial: string,
    apkPath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { stdout, stderr } = await execFileAsync(this.adbPath, [
        "-s",
        serial,
        "install",
        "-r",
        apkPath,
      ]);
      const output = stdout + stderr;
      if (output.includes("Success")) {
        return { success: true };
      }
      const failMatch = output.match(/Failure \[(\w+)\]/);
      return {
        success: false,
        error: failMatch ? failMatch[1] : "Unknown install error",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Install failed",
      };
    }
  }

  async getRunningPackage(serial: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync(this.adbPath, [
        "-s",
        serial,
        "shell",
        "dumpsys",
        "activity",
        "activities",
      ]);
      // Look for "mResumedActivity" or "topResumedActivity"
      const match = stdout.match(
        /(?:mResumedActivity|topResumedActivity).*?([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)\//
      );
      return match?.[1];
    } catch {
      return undefined;
    }
  }

  async killEmulator(serial: string): Promise<void> {
    await execFileAsync(this.adbPath, ["-s", serial, "emu", "kill"]);
  }

  async isBootComplete(serial: string): Promise<boolean> {
    const value = await this.getDeviceProperty(serial, "sys.boot_completed");
    return value === "1";
  }
}

export function parseDeviceList(output: string): AndroidDevice[] {
  const lines = output.split("\n");
  const devices: AndroidDevice[] = [];

  for (const line of lines) {
    // Skip header and empty lines
    if (
      line.startsWith("List of devices") ||
      line.trim().length === 0 ||
      line.startsWith("*")
    ) {
      continue;
    }

    const parts = line.split("\t");
    if (parts.length < 2) {
      continue;
    }

    const serial = parts[0].trim();
    const rest = parts[1].trim();
    const stateStr = rest.split(/\s+/)[0];

    const state = parseDeviceState(stateStr);
    const type: DeviceType = serial.startsWith("emulator-")
      ? "emulator"
      : "physical";

    // Parse long-format properties
    const props = parseLongFormatProps(rest);

    devices.push({
      serial,
      state,
      type,
      model: props.model?.replace(/_/g, " "),
      product: props.product,
    });
  }

  return devices;
}

function parseDeviceState(state: string): DeviceState {
  switch (state) {
    case "device":
      return "device";
    case "offline":
      return "offline";
    case "unauthorized":
      return "unauthorized";
    default:
      return "unknown";
  }
}

function parseLongFormatProps(
  rest: string
): Record<string, string | undefined> {
  const props: Record<string, string | undefined> = {};
  const matches = rest.matchAll(/(\w+):(\S+)/g);
  for (const match of matches) {
    props[match[1]] = match[2];
  }
  return props;
}
