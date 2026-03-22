import * as vscode from "vscode";
import { detectSdkPath } from "./utils/sdk";
import { getAdbPath, getEmulatorPath } from "./utils/platform";
import {
  getSdkPath,
  getAdbPathOverride,
  getDevicePollingInterval,
} from "./utils/config";
import { ProcessManager } from "./services/processManager";
import { GradleService } from "./services/gradleService";
import { AdbService } from "./services/adbService";
import { EmulatorService } from "./services/emulatorService";
import { LogcatService } from "./services/logcatService";
import { GradleTaskProvider } from "./providers/gradleTaskProvider";
import { DeviceTreeProvider } from "./providers/deviceTreeProvider";
import { LogcatViewProvider } from "./providers/logcatViewProvider";
import { registerGradleCommands } from "./commands/gradle";
import { registerDeviceCommands } from "./commands/device";
import { registerLogcatCommands } from "./commands/logcat";

let processManager: ProcessManager;
let deviceProvider: DeviceTreeProvider;

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // Initialize process manager
  processManager = new ProcessManager();
  context.subscriptions.push(
    new vscode.Disposable(() => processManager.dispose())
  );

  // Detect Android SDK
  const sdkResult = detectSdkPath(getSdkPath(), workspaceRoot);
  if (!sdkResult.sdkPath) {
    vscode.window
      .showWarningMessage(
        "Android SDK not found. Configure it in settings.",
        "Open Settings"
      )
      .then((action) => {
        if (action === "Open Settings") {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "androidToolkit.sdkPath"
          );
        }
      });
  }

  const sdkPath = sdkResult.sdkPath ?? "";
  const adbPathOverride = getAdbPathOverride();
  const resolvedAdbPath = adbPathOverride || getAdbPath(sdkPath);
  const resolvedEmulatorPath = getEmulatorPath(sdkPath);

  // Initialize services
  const gradleService = new GradleService(processManager);
  const adbService = new AdbService(resolvedAdbPath);
  const emulatorService = new EmulatorService(
    resolvedEmulatorPath,
    processManager,
    adbService
  );
  const logcatService = new LogcatService(resolvedAdbPath, processManager);

  // Initialize providers
  const gradleProvider = new GradleTaskProvider(
    gradleService,
    workspaceRoot
  );
  deviceProvider = new DeviceTreeProvider(
    adbService,
    emulatorService,
    getDevicePollingInterval()
  );
  const logcatProvider = new LogcatViewProvider(
    context.extensionUri,
    logcatService
  );

  // Register tree views
  const gradleTreeView = vscode.window.createTreeView(
    "androidToolkit.gradleTasks",
    { treeDataProvider: gradleProvider, showCollapseAll: true }
  );
  const deviceTreeView = vscode.window.createTreeView(
    "androidToolkit.deviceManager",
    { treeDataProvider: deviceProvider }
  );

  // Register webview provider
  const logcatViewDisposable =
    vscode.window.registerWebviewViewProvider(
      "androidToolkit.logcatView",
      logcatProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    );

  // Create output channel
  const outputChannel =
    vscode.window.createOutputChannel("Android Toolkit: Gradle");

  // Status bar items
  const deviceStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  deviceStatusBar.command = "androidToolkit.selectDevice";
  deviceStatusBar.tooltip = "Active Android device";

  const buildStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99
  );

  // Wire device change → logcat + status bar
  deviceProvider.onDidChangeActiveDevice((device) => {
    if (device) {
      deviceStatusBar.text = `$(device-mobile) ${device.model ?? device.serial}`;
      deviceStatusBar.show();

      // Auto-start logcat on device selection
      logcatProvider.startStreaming(device.serial);
    } else {
      deviceStatusBar.hide();
      logcatProvider.stopStreaming();
    }
  });

  // Register commands
  registerGradleCommands(
    context,
    gradleService,
    gradleProvider,
    outputChannel,
    workspaceRoot
  );
  registerDeviceCommands(
    context,
    adbService,
    emulatorService,
    deviceProvider
  );
  registerLogcatCommands(context, logcatProvider);

  // Build and Run command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "androidToolkit.buildAndRun",
      async () => {
        if (!workspaceRoot) {
          vscode.window.showErrorMessage("No workspace folder open.");
          return;
        }

        const active = deviceProvider.activeDevice;
        if (!active) {
          vscode.window.showWarningMessage("No active device selected.");
          return;
        }

        buildStatusBar.text = "$(loading~spin) Building...";
        buildStatusBar.show();

        try {
          outputChannel.clear();
          outputChannel.show(true);

          const result = await gradleService.runTask(
            "installDebug",
            workspaceRoot,
            (line) => outputChannel.append(line)
          );

          if (result.success) {
            buildStatusBar.text = "$(check) Build OK";
            vscode.window.showInformationMessage(
              "Build and install successful!"
            );
          } else {
            buildStatusBar.text = "$(error) Build Failed";
            vscode.window.showErrorMessage("Build failed.");
          }
        } catch (err) {
          buildStatusBar.text = "$(error) Build Failed";
          vscode.window.showErrorMessage(
            `Build error: ${err instanceof Error ? err.message : "Unknown"}`
          );
        }

        // Clear build status after 10 seconds
        setTimeout(() => {
          buildStatusBar.hide();
        }, 10000);
      }
    )
  );

  // Watch for Gradle file changes
  const gradleWatcher = vscode.workspace.createFileSystemWatcher(
    "**/*.gradle{,.kts}"
  );
  let debounceTimer: NodeJS.Timeout | undefined;
  gradleWatcher.onDidChange(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => gradleProvider.refresh(), 500);
  });

  // Listen for config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("androidToolkit.sdkPath")) {
        const newResult = detectSdkPath(getSdkPath(), workspaceRoot);
        if (newResult.sdkPath) {
          const newAdb = getAdbPath(newResult.sdkPath);
          const newEmulator = getEmulatorPath(newResult.sdkPath);
          adbService.updateAdbPath(newAdb);
          emulatorService.updateEmulatorPath(newEmulator);
          logcatService.updateAdbPath(newAdb);
        }
      }
      if (e.affectsConfiguration("androidToolkit.adbPath")) {
        const override = getAdbPathOverride();
        if (override) {
          adbService.updateAdbPath(override);
          logcatService.updateAdbPath(override);
        }
      }
    })
  );

  // Start device polling
  if (sdkResult.sdkPath) {
    deviceProvider.startPolling();
  }

  // Push all disposables
  context.subscriptions.push(
    gradleTreeView,
    deviceTreeView,
    logcatViewDisposable,
    outputChannel,
    deviceStatusBar,
    buildStatusBar,
    gradleWatcher,
    new vscode.Disposable(() => deviceProvider.dispose())
  );

  if (sdkResult.sdkPath) {
    outputChannel.appendLine(
      `Android SDK detected at: ${sdkResult.sdkPath} (via ${sdkResult.source})`
    );
  }
}

export function deactivate(): void {
  if (deviceProvider) {
    deviceProvider.stopPolling();
  }
  if (processManager) {
    processManager.dispose();
  }
}
