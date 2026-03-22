import * as vscode from "vscode";
import { GradleTask, TaskGroup } from "../models/gradleTask";
import { GradleService } from "../services/gradleService";

type GradleTreeItem = TaskGroup | GradleTask;

export class GradleTaskProvider
  implements vscode.TreeDataProvider<GradleTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    GradleTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private groups: TaskGroup[] = [];
  private loading = false;

  constructor(
    private gradleService: GradleService,
    private workspaceRoot: string | undefined
  ) {}

  refresh(): void {
    this.groups = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: GradleTreeItem): vscode.TreeItem {
    if (isTaskGroup(element)) {
      const item = new vscode.TreeItem(
        element.name,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = "gradleTaskGroup";
      item.iconPath = new vscode.ThemeIcon("folder");
      return item;
    }

    const task = element as GradleTask;
    const item = new vscode.TreeItem(
      task.name,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = task.description;
    item.contextValue = "gradleTask";
    item.iconPath = new vscode.ThemeIcon("symbol-event");
    item.command = {
      command: "androidToolkit.runGradleTask",
      title: "Run Task",
      arguments: [task],
    };
    return item;
  }

  async getChildren(
    element?: GradleTreeItem
  ): Promise<GradleTreeItem[]> {
    if (!this.workspaceRoot) {
      return [];
    }

    if (!element) {
      // Root level — return task groups
      if (this.groups.length === 0 && !this.loading) {
        await this.loadTasks();
      }
      return this.groups;
    }

    if (isTaskGroup(element)) {
      return element.tasks;
    }

    return [];
  }

  private async loadTasks(): Promise<void> {
    if (!this.workspaceRoot || this.loading) {
      return;
    }

    this.loading = true;
    try {
      this.groups = await this.gradleService.discoverTasks(
        this.workspaceRoot
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load tasks";
      vscode.window.showErrorMessage(
        `Android Toolkit: ${message}`
      );
      this.groups = [];
    } finally {
      this.loading = false;
      this._onDidChangeTreeData.fire(undefined);
    }
  }
}

function isTaskGroup(item: GradleTreeItem): item is TaskGroup {
  return "tasks" in item;
}
