import * as vscode from "vscode";
import { GradleTask } from "../models/gradleTask";
import { GradleService } from "../services/gradleService";
import { GradleTaskProvider } from "../providers/gradleTaskProvider";

export function registerGradleCommands(
  context: vscode.ExtensionContext,
  gradleService: GradleService,
  gradleProvider: GradleTaskProvider,
  outputChannel: vscode.OutputChannel,
  workspaceRoot: string | undefined
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "androidToolkit.runGradleTask",
      async (task?: GradleTask) => {
        if (!workspaceRoot) {
          vscode.window.showErrorMessage("No workspace folder open.");
          return;
        }

        if (gradleService.isBuildRunning()) {
          const action = await vscode.window.showWarningMessage(
            "A build is already in progress.",
            "Cancel Build"
          );
          if (action === "Cancel Build") {
            await gradleService.stopBuild();
          }
          return;
        }

        const taskPath = task?.fullTaskPath;
        if (!taskPath) {
          const input = await vscode.window.showInputBox({
            prompt: "Enter Gradle task path (e.g., assembleDebug)",
            placeHolder: "assembleDebug",
          });
          if (!input) {
            return;
          }
          await runGradleTask(
            input,
            workspaceRoot,
            gradleService,
            outputChannel
          );
        } else {
          await runGradleTask(
            taskPath,
            workspaceRoot,
            gradleService,
            outputChannel
          );
        }
      }
    ),

    vscode.commands.registerCommand(
      "androidToolkit.refreshGradleTasks",
      () => {
        gradleProvider.refresh();
      }
    ),

    vscode.commands.registerCommand(
      "androidToolkit.stopGradleBuild",
      async () => {
        if (gradleService.isBuildRunning()) {
          await gradleService.stopBuild();
          vscode.window.showInformationMessage("Build cancelled.");
        }
      }
    )
  );
}

async function runGradleTask(
  taskPath: string,
  workspaceRoot: string,
  gradleService: GradleService,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  outputChannel.clear();
  outputChannel.show(true);
  outputChannel.appendLine(`> Running: ${taskPath}\n`);

  try {
    const result = await gradleService.runTask(
      taskPath,
      workspaceRoot,
      (line) => outputChannel.append(line)
    );

    if (result.success) {
      vscode.window.showInformationMessage(
        `Build successful${result.duration ? ` in ${result.duration}` : ""}`
      );
    } else {
      vscode.window.showErrorMessage(
        `Build failed${result.duration ? ` in ${result.duration}` : ""}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Build failed";
    vscode.window.showErrorMessage(`Android Toolkit: ${message}`);
    outputChannel.appendLine(`\nError: ${message}`);
  }
}
