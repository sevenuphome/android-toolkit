import * as vscode from "vscode";
import { AdbService } from "../services/adbService";
import { EmulatorService } from "../services/emulatorService";
import { DeviceTreeProvider } from "../providers/deviceTreeProvider";

export function registerDeviceCommands(
  context: vscode.ExtensionContext,
  adbService: AdbService,
  emulatorService: EmulatorService,
  deviceProvider: DeviceTreeProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "androidToolkit.refreshDevices",
      () => {
        deviceProvider.refresh();
      }
    ),

    vscode.commands.registerCommand(
      "androidToolkit.selectDevice",
      (serial?: string) => {
        if (serial) {
          deviceProvider.setActiveDevice(serial);
          vscode.window.showInformationMessage(
            `Active device: ${serial}`
          );
        }
      }
    ),

    vscode.commands.registerCommand(
      "androidToolkit.launchEmulator",
      async (avdName?: string) => {
        if (!avdName) {
          const avds = await emulatorService.listAvds();
          if (avds.length === 0) {
            vscode.window.showWarningMessage(
              "No AVD emulators found. Create one in Android Studio or using avdmanager."
            );
            return;
          }
          avdName = await vscode.window.showQuickPick(avds, {
            placeHolder: "Select an emulator to launch",
          });
          if (!avdName) {
            return;
          }
        }

        vscode.window.showInformationMessage(
          `Launching emulator: ${avdName}...`
        );
        emulatorService.launchEmulator(avdName);
      }
    ),

    vscode.commands.registerCommand(
      "androidToolkit.stopEmulator",
      async (serial?: string) => {
        if (!serial) {
          return;
        }
        try {
          await emulatorService.stopEmulator(serial);
          vscode.window.showInformationMessage("Emulator stopped.");
        } catch (err) {
          vscode.window.showErrorMessage(
            `Failed to stop emulator: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }
    ),

    vscode.commands.registerCommand(
      "androidToolkit.installApk",
      async () => {
        const active = deviceProvider.activeDevice;
        if (!active) {
          vscode.window.showWarningMessage("No active device selected.");
          return;
        }

        const uris = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { "APK Files": ["apk"] },
          title: "Select APK to install",
        });

        if (!uris || uris.length === 0) {
          return;
        }

        const apkPath = uris[0].fsPath;
        vscode.window.showInformationMessage(
          `Installing APK to ${active.serial}...`
        );

        const result = await adbService.installApk(active.serial, apkPath);
        if (result.success) {
          vscode.window.showInformationMessage("APK installed successfully.");
        } else {
          vscode.window.showErrorMessage(
            `Install failed: ${result.error}`
          );
        }
      }
    )
  );
}
