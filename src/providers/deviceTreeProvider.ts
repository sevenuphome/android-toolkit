import * as vscode from "vscode";
import { AndroidDevice, AvdEmulator } from "../models/device";
import { AdbService } from "../services/adbService";
import { EmulatorService } from "../services/emulatorService";

type DeviceTreeItem = SectionHeader | AndroidDevice | AvdEmulator;

interface SectionHeader {
  label: string;
  kind: "connected" | "emulators";
}

export class DeviceTreeProvider
  implements vscode.TreeDataProvider<DeviceTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    DeviceTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidChangeActiveDevice = new vscode.EventEmitter<
    AndroidDevice | undefined
  >();
  readonly onDidChangeActiveDevice = this._onDidChangeActiveDevice.event;

  private devices: AndroidDevice[] = [];
  private emulators: AvdEmulator[] = [];
  private activeDeviceSerial: string | undefined;
  private pollingTimer: NodeJS.Timeout | undefined;

  constructor(
    private adbService: AdbService,
    private emulatorService: EmulatorService,
    private pollingInterval: number
  ) {}

  get activeDevice(): AndroidDevice | undefined {
    return this.devices.find((d) => d.serial === this.activeDeviceSerial);
  }

  setActiveDevice(serial: string | undefined): void {
    this.activeDeviceSerial = serial;
    this._onDidChangeActiveDevice.fire(this.activeDevice);
    this._onDidChangeTreeData.fire(undefined);
  }

  startPolling(): void {
    this.refresh();
    this.pollingTimer = setInterval(() => this.refresh(), this.pollingInterval);
  }

  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  async refresh(): Promise<void> {
    try {
      const prevSerials = new Set(this.devices.map((d) => d.serial));
      this.devices = await this.adbService.listDevices();
      const currentSerials = this.devices.map((d) => d.serial);

      this.emulators = await this.emulatorService.listAvdsWithStatus(
        currentSerials
      );

      // Auto-select if only one device and none selected
      if (
        !this.activeDeviceSerial &&
        this.devices.length === 1 &&
        this.devices[0].state === "device"
      ) {
        this.setActiveDevice(this.devices[0].serial);
      }

      // Clear selection if active device disconnected
      if (
        this.activeDeviceSerial &&
        !currentSerials.includes(this.activeDeviceSerial)
      ) {
        this.setActiveDevice(undefined);
      }

      // Notify if device list changed
      const newSerials = new Set(currentSerials);
      if (
        prevSerials.size !== newSerials.size ||
        [...prevSerials].some((s) => !newSerials.has(s))
      ) {
        this._onDidChangeTreeData.fire(undefined);
      }
    } catch {
      // ADB not available — show empty
      this.devices = [];
      this.emulators = [];
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  getTreeItem(element: DeviceTreeItem): vscode.TreeItem {
    if (isSectionHeader(element)) {
      const item = new vscode.TreeItem(
        element.label,
        vscode.TreeItemCollapsibleState.Expanded
      );
      item.contextValue = "section";
      return item;
    }

    if (isAndroidDevice(element)) {
      const isActive = element.serial === this.activeDeviceSerial;
      const label = element.model ?? element.serial;
      const item = new vscode.TreeItem(
        label,
        vscode.TreeItemCollapsibleState.None
      );

      item.description = [
        element.apiLevel ? `API ${element.apiLevel}` : undefined,
        element.state !== "device" ? element.state : undefined,
        isActive ? "(active)" : undefined,
      ]
        .filter(Boolean)
        .join(" - ");

      item.contextValue =
        element.type === "emulator" ? "runningEmulator" : "connectedDevice";
      item.iconPath = new vscode.ThemeIcon(
        element.type === "emulator" ? "vm" : "device-mobile"
      );
      item.command = {
        command: "androidToolkit.selectDevice",
        title: "Select Device",
        arguments: [element.serial],
      };
      return item;
    }

    // AvdEmulator
    const emu = element as AvdEmulator;
    const item = new vscode.TreeItem(
      emu.name.replace(/_/g, " "),
      vscode.TreeItemCollapsibleState.None
    );
    item.contextValue = emu.running ? "runningEmulator" : "availableEmulator";
    item.iconPath = new vscode.ThemeIcon(emu.running ? "vm-running" : "vm");
    item.description = emu.running ? "Running" : "";

    if (!emu.running) {
      item.command = {
        command: "androidToolkit.launchEmulator",
        title: "Launch Emulator",
        arguments: [emu.name],
      };
    }
    return item;
  }

  async getChildren(element?: DeviceTreeItem): Promise<DeviceTreeItem[]> {
    if (!element) {
      // Root: show sections
      const sections: SectionHeader[] = [];
      if (this.devices.length > 0) {
        sections.push({ label: "Connected Devices", kind: "connected" });
      }
      if (this.emulators.length > 0) {
        sections.push({ label: "Available Emulators", kind: "emulators" });
      }
      // If nothing, return empty (welcome view will show)
      if (sections.length === 0) {
        return [];
      }
      return sections;
    }

    if (isSectionHeader(element)) {
      if (element.kind === "connected") {
        return this.devices;
      }
      return this.emulators.filter((e) => !e.running);
    }

    return [];
  }

  dispose(): void {
    this.stopPolling();
    this._onDidChangeTreeData.dispose();
    this._onDidChangeActiveDevice.dispose();
  }
}

function isSectionHeader(item: DeviceTreeItem): item is SectionHeader {
  return "kind" in item;
}

function isAndroidDevice(item: DeviceTreeItem): item is AndroidDevice {
  return "serial" in item;
}
