import { describe, it, expect } from "vitest";
import { parseDeviceList } from "../../src/services/adbService";

describe("parseDeviceList", () => {
  it("should parse basic device list", () => {
    const output = `List of devices attached
emulator-5554\tdevice
0a388e93\tdevice

`;
    const devices = parseDeviceList(output);
    expect(devices).toHaveLength(2);
    expect(devices[0].serial).toBe("emulator-5554");
    expect(devices[0].type).toBe("emulator");
    expect(devices[0].state).toBe("device");
    expect(devices[1].serial).toBe("0a388e93");
    expect(devices[1].type).toBe("physical");
  });

  it("should parse long format with properties", () => {
    const output = `List of devices attached
emulator-5556\tdevice product:sdk_google_phone_x86_64 model:Android_SDK_built_for_x86_64 device:generic_x86_64
0a388e93\tdevice usb:1-1 product:razor model:Nexus_7 device:flo

`;
    const devices = parseDeviceList(output);
    expect(devices).toHaveLength(2);
    expect(devices[0].model).toBe("Android SDK built for x86 64");
    expect(devices[0].product).toBe("sdk_google_phone_x86_64");
    expect(devices[1].model).toBe("Nexus 7");
  });

  it("should handle offline and unauthorized states", () => {
    const output = `List of devices attached
emulator-5554\toffline
abc123\tunauthorized

`;
    const devices = parseDeviceList(output);
    expect(devices[0].state).toBe("offline");
    expect(devices[1].state).toBe("unauthorized");
  });

  it("should handle empty list", () => {
    const output = `List of devices attached

`;
    const devices = parseDeviceList(output);
    expect(devices).toHaveLength(0);
  });
});
