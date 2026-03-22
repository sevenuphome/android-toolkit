export type DeviceType = "physical" | "emulator";

export type DeviceState = "device" | "offline" | "unauthorized" | "unknown";

export interface AndroidDevice {
  serial: string;
  state: DeviceState;
  type: DeviceType;
  model?: string;
  apiLevel?: string;
  product?: string;
}

export interface AvdEmulator {
  name: string;
  running: boolean;
  serial?: string;
}
