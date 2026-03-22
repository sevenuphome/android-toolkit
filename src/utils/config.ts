import * as vscode from "vscode";

const SECTION = "androidToolkit";

export function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(SECTION);
}

export function getSdkPath(): string {
  return getConfig().get<string>("sdkPath", "");
}

export function getJavaHome(): string {
  return getConfig().get<string>("javaHome", "");
}

export function getAdbPathOverride(): string {
  return getConfig().get<string>("adbPath", "");
}

export function getLogcatBufferSize(): number {
  return getConfig().get<number>("logcatBufferSize", 10000);
}

export function getDevicePollingInterval(): number {
  return getConfig().get<number>("devicePollingInterval", 3000);
}
