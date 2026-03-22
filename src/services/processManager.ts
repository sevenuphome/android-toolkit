import { spawn, ChildProcess, SpawnOptions } from "child_process";
import treekill from "tree-kill";

export interface ManagedProcess {
  id: string;
  process: ChildProcess;
  command: string;
}

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private nextId = 1;

  spawn(
    command: string,
    args: string[],
    options?: SpawnOptions
  ): ManagedProcess {
    const id = `proc-${this.nextId++}`;
    const child = spawn(command, args, options ?? {});

    const managed: ManagedProcess = { id, process: child, command };
    this.processes.set(id, managed);

    child.on("exit", () => {
      this.processes.delete(id);
    });

    child.on("error", () => {
      this.processes.delete(id);
    });

    return managed;
  }

  kill(id: string): Promise<void> {
    return new Promise((resolve) => {
      const managed = this.processes.get(id);
      if (!managed || managed.process.pid === undefined) {
        this.processes.delete(id);
        resolve();
        return;
      }

      const pid = managed.process.pid;
      this.processes.delete(id);

      treekill(pid, "SIGTERM", (err) => {
        if (err) {
          // Force kill if graceful termination fails
          try {
            process.kill(pid, "SIGKILL");
          } catch {
            // Process already dead
          }
        }
        resolve();
      });
    });
  }

  async killAll(): Promise<void> {
    const ids = Array.from(this.processes.keys());
    await Promise.all(ids.map((id) => this.kill(id)));
  }

  isRunning(id: string): boolean {
    return this.processes.has(id);
  }

  getProcess(id: string): ManagedProcess | undefined {
    return this.processes.get(id);
  }

  dispose(): void {
    this.killAll();
  }
}
