import { LogEntry, parseLogcatLine } from "../models/logEntry";
import { normalizeLineEndings } from "../utils/platform";
import { ProcessManager, ManagedProcess } from "./processManager";

type LogcatListener<T> = (data: T) => void;

export class LogcatService {
  private currentStream: ManagedProcess | undefined;
  private buffer = "";

  private logEntryListeners: LogcatListener<LogEntry>[] = [];
  private rawLineListeners: LogcatListener<string>[] = [];
  private stoppedListeners: LogcatListener<void>[] = [];
  private errorListeners: LogcatListener<Error>[] = [];

  constructor(
    private adbPath: string,
    private processManager: ProcessManager
  ) {}

  updateAdbPath(newPath: string): void {
    this.adbPath = newPath;
  }

  onLogEntry(listener: LogcatListener<LogEntry>): void {
    this.logEntryListeners.push(listener);
  }

  onRawLine(listener: LogcatListener<string>): void {
    this.rawLineListeners.push(listener);
  }

  onStopped(listener: LogcatListener<void>): void {
    this.stoppedListeners.push(listener);
  }

  onError(listener: LogcatListener<Error>): void {
    this.errorListeners.push(listener);
  }

  startStreaming(serial: string): void {
    this.stopStreaming();

    const managed = this.processManager.spawn(
      this.adbPath,
      ["-s", serial, "logcat", "-v", "threadtime"],
      {}
    );

    this.currentStream = managed;
    this.buffer = "";

    managed.process.stdout?.on("data", (data: Buffer) => {
      this.buffer += normalizeLineEndings(data.toString());
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim().length === 0) {
          continue;
        }
        const entry = parseLogcatLine(line);
        if (entry) {
          this.logEntryListeners.forEach((l) => l(entry));
        } else {
          this.rawLineListeners.forEach((l) => l(line));
        }
      }
    });

    managed.process.on("exit", () => {
      this.currentStream = undefined;
      this.stoppedListeners.forEach((l) => l());
    });

    managed.process.on("error", (err: Error) => {
      this.currentStream = undefined;
      this.errorListeners.forEach((l) => l(err));
    });
  }

  stopStreaming(): void {
    if (this.currentStream) {
      this.processManager.kill(this.currentStream.id);
      this.currentStream = undefined;
      this.buffer = "";
    }
  }

  isStreaming(): boolean {
    return this.currentStream !== undefined;
  }

  clearDeviceLog(serial: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const managed = this.processManager.spawn(
        this.adbPath,
        ["-s", serial, "logcat", "-c"],
        {}
      );
      managed.process.on("close", () => resolve());
      managed.process.on("error", reject);
    });
  }
}
