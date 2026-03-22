import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectSdkPath } from "../../src/utils/sdk";
import * as fs from "fs";
import * as os from "os";

vi.mock("fs");
vi.mock("os");

describe("detectSdkPath", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.mocked(fs.accessSync).mockImplementation(() => {
      throw new Error("not found");
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should use configured path when valid", () => {
    vi.mocked(fs.accessSync).mockImplementation(() => undefined);
    const result = detectSdkPath("/custom/sdk");
    expect(result.sdkPath).toBe("/custom/sdk");
    expect(result.source).toBe("extension settings");
  });

  it("should fall back to ANDROID_HOME", () => {
    process.env.ANDROID_HOME = "/env/android/sdk";
    vi.mocked(fs.accessSync).mockImplementation((path) => {
      if (String(path).includes("/env/android/sdk")) {
        return undefined;
      }
      throw new Error("not found");
    });

    const result = detectSdkPath("");
    expect(result.sdkPath).toBe("/env/android/sdk");
    expect(result.source).toBe("ANDROID_HOME");
  });

  it("should fall back to ANDROID_SDK_ROOT", () => {
    delete process.env.ANDROID_HOME;
    process.env.ANDROID_SDK_ROOT = "/sdk/root";
    vi.mocked(fs.accessSync).mockImplementation((path) => {
      if (String(path).includes("/sdk/root")) {
        return undefined;
      }
      throw new Error("not found");
    });

    const result = detectSdkPath("");
    expect(result.sdkPath).toBe("/sdk/root");
    expect(result.source).toBe("ANDROID_SDK_ROOT");
  });

  it("should read local.properties", () => {
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;

    vi.mocked(fs.readFileSync).mockReturnValue(
      "sdk.dir=/from/local/properties\n"
    );
    vi.mocked(fs.accessSync).mockImplementation((path) => {
      if (String(path).includes("/from/local/properties")) {
        return undefined;
      }
      throw new Error("not found");
    });

    const result = detectSdkPath("", "/workspace");
    expect(result.sdkPath).toBe("/from/local/properties");
    expect(result.source).toBe("local.properties");
  });

  it("should try macOS default path", () => {
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
    vi.mocked(os.homedir).mockReturnValue("/Users/test");
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("no file");
    });

    const macPath = "/Users/test/Library/Android/sdk";
    vi.mocked(fs.accessSync).mockImplementation((path) => {
      if (String(path).includes(macPath)) {
        return undefined;
      }
      throw new Error("not found");
    });

    // Only works on darwin
    const origPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { value: "darwin" });

    const result = detectSdkPath("");
    expect(result.sdkPath).toBe(macPath);
    expect(result.source).toBe("default location");

    if (origPlatform) {
      Object.defineProperty(process, "platform", origPlatform);
    }
  });

  it("should return undefined when nothing found", () => {
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
    vi.mocked(os.homedir).mockReturnValue("/nonexistent");
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("no file");
    });

    const result = detectSdkPath("");
    expect(result.sdkPath).toBeUndefined();
    expect(result.source).toBe("not found");
  });
});
