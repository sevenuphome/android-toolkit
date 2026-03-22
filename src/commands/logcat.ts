import * as vscode from "vscode";
import { LogcatViewProvider } from "../providers/logcatViewProvider";

export function registerLogcatCommands(
  context: vscode.ExtensionContext,
  logcatProvider: LogcatViewProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("androidToolkit.showLogcat", () => {
      vscode.commands.executeCommand("androidToolkit.logcatView.focus");
    }),

    vscode.commands.registerCommand("androidToolkit.clearLogcat", () => {
      logcatProvider.clear();
    }),

    vscode.commands.registerCommand(
      "androidToolkit.toggleLogcatPause",
      () => {
        logcatProvider.togglePause();
      }
    )
  );
}
