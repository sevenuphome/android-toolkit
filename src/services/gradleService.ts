import * as fs from "fs";
import * as path from "path";
import { GradleTask, TaskGroup } from "../models/gradleTask";
import {
  getGradleWrapper,
  getSpawnOptions,
  normalizeLineEndings,
} from "../utils/platform";
import { ProcessManager, ManagedProcess } from "./processManager";

export class GradleService {
  private currentBuild: ManagedProcess | undefined;

  constructor(private processManager: ProcessManager) {}

  isGradleProject(workspaceRoot: string): boolean {
    return getGradleWrapper(workspaceRoot) !== undefined;
  }

  async discoverModules(workspaceRoot: string): Promise<string[]> {
    const modules: string[] = [];

    // Try settings.gradle.kts first, then settings.gradle
    for (const filename of ["settings.gradle.kts", "settings.gradle"]) {
      const settingsPath = path.join(workspaceRoot, filename);
      try {
        const content = fs.readFileSync(settingsPath, "utf-8");
        const includeRegex = /include\s*\(?['":]+([^'"]+)['"]/g;
        let match;
        while ((match = includeRegex.exec(content)) !== null) {
          modules.push(match[1]);
        }
        if (modules.length > 0) {
          return modules;
        }
      } catch {
        // File doesn't exist, try next
      }
    }

    return modules;
  }

  discoverTasks(
    workspaceRoot: string,
    onOutput?: (line: string) => void
  ): Promise<TaskGroup[]> {
    return new Promise((resolve, reject) => {
      const wrapper = getGradleWrapper(workspaceRoot);
      if (!wrapper) {
        reject(new Error("Gradle wrapper not found"));
        return;
      }

      const managed = this.processManager.spawn(
        wrapper,
        ["tasks", "--all", "--console=plain"],
        getSpawnOptions(workspaceRoot)
      );

      let stdout = "";

      managed.process.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        onOutput?.(text);
      });

      managed.process.stderr?.on("data", (data: Buffer) => {
        onOutput?.(data.toString());
      });

      managed.process.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Gradle tasks failed with code ${code}`));
          return;
        }
        resolve(parseTaskOutput(normalizeLineEndings(stdout)));
      });

      managed.process.on("error", (err) => {
        reject(err);
      });
    });
  }

  runTask(
    taskPath: string,
    workspaceRoot: string,
    onOutput?: (line: string) => void
  ): Promise<{ success: boolean; duration?: string }> {
    return new Promise((resolve, reject) => {
      if (this.currentBuild) {
        reject(new Error("A build is already in progress"));
        return;
      }

      const wrapper = getGradleWrapper(workspaceRoot);
      if (!wrapper) {
        reject(new Error("Gradle wrapper not found"));
        return;
      }

      const managed = this.processManager.spawn(
        wrapper,
        [taskPath, "--console=plain"],
        getSpawnOptions(workspaceRoot)
      );
      this.currentBuild = managed;

      let allOutput = "";

      managed.process.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        allOutput += text;
        onOutput?.(text);
      });

      managed.process.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        allOutput += text;
        onOutput?.(text);
      });

      managed.process.on("close", (code) => {
        this.currentBuild = undefined;
        const normalized = normalizeLineEndings(allOutput);
        const successMatch = normalized.match(
          /BUILD SUCCESSFUL in (.+)/
        );
        const failMatch = normalized.match(/BUILD FAILED in (.+)/);

        resolve({
          success: code === 0 && !!successMatch,
          duration: successMatch?.[1] ?? failMatch?.[1],
        });
      });

      managed.process.on("error", (err) => {
        this.currentBuild = undefined;
        reject(err);
      });
    });
  }

  async stopBuild(): Promise<void> {
    if (this.currentBuild) {
      await this.processManager.kill(this.currentBuild.id);
      this.currentBuild = undefined;
    }
  }

  isBuildRunning(): boolean {
    return this.currentBuild !== undefined;
  }
}

function parseTaskOutput(output: string): TaskGroup[] {
  const lines = output.split("\n");
  const groups: TaskGroup[] = [];
  let currentGroup: TaskGroup | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    // Group header: a text line followed by a line of dashes
    if (nextLine && /^-+$/.test(nextLine.trim()) && line.trim().length > 0) {
      const groupName = line.trim();
      // Skip the "Tasks runnable from" header
      if (!groupName.startsWith("Tasks runnable from")) {
        currentGroup = { name: groupName, tasks: [] };
        groups.push(currentGroup);
      }
      i++; // Skip the dashes line
      continue;
    }

    // Task line: "taskName - description"
    if (currentGroup) {
      const taskMatch = line.match(/^(\S+) - (.+)$/);
      if (taskMatch) {
        currentGroup.tasks.push({
          name: taskMatch[1],
          description: taskMatch[2],
          group: currentGroup.name,
          modulePath: "",
          fullTaskPath: taskMatch[1],
        });
      }
    }
  }

  return groups.filter((g) => g.tasks.length > 0);
}

export { parseTaskOutput };
