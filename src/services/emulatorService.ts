import { execFile } from "child_process";
import { promisify } from "util";
import { AvdEmulator } from "../models/device";
import { normalizeLineEndings } from "../utils/platform";
import { ProcessManager, ManagedProcess } from "./processManager";
import { AdbService } from "./adbService";

const execFileAsync = promisify(execFile);

export class EmulatorService {
  private runningEmulators = new Map<string, ManagedProcess>();

  constructor(
    private emulatorPath: string,
    private processManager: ProcessManager,
    private adbService: AdbService
  ) {}

  updateEmulatorPath(newPath: string): void {
    this.emulatorPath = newPath;
  }

  async listAvds(): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(this.emulatorPath, [
        "-list-avds",
      ]);
      return normalizeLineEndings(stdout)
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    } catch {
      return [];
    }
  }

  async listAvdsWithStatus(
    connectedSerials: string[]
  ): Promise<AvdEmulator[]> {
    const avdNames = await this.listAvds();
    return avdNames.map((name) => {
      const running = this.runningEmulators.has(name);
      const serial = running
        ? this.findEmulatorSerial(name, connectedSerials)
        : undefined;
      return { name, running, serial };
    });
  }

  launchEmulator(avdName: string): ManagedProcess {
    const managed = this.processManager.spawn(
      this.emulatorPath,
      [`@${avdName}`],
      { detached: true, stdio: "ignore" }
    );

    this.runningEmulators.set(avdName, managed);

    managed.process.on("exit", () => {
      this.runningEmulators.delete(avdName);
    });

    return managed;
  }

  async stopEmulator(serial: string): Promise<void> {
    await this.adbService.killEmulator(serial);
  }

  async waitForBoot(
    serial: string,
    timeoutMs: number = 120000
  ): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.adbService.isBootComplete(serial)) {
        return true;
      }
      await sleep(2000);
    }
    return false;
  }

  isEmulatorRunning(avdName: string): boolean {
    return this.runningEmulators.has(avdName);
  }

  private findEmulatorSerial(
    _avdName: string,
    connectedSerials: string[]
  ): string | undefined {
    // Emulator serials are like "emulator-5554"
    // For now, return the first emulator serial not already matched
    return connectedSerials.find((s) => s.startsWith("emulator-"));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
