import { describe, it, expect } from "vitest";
import { parseLogcatLine, LogLevel } from "../../src/models/logEntry";

describe("parseLogcatLine", () => {
  it("should parse threadtime format", () => {
    const line =
      "04-01 16:05:35.099   158   163 D dalvikvm: GC_CONCURRENT freed 384K";
    const entry = parseLogcatLine(line);
    expect(entry).toBeDefined();
    expect(entry!.date).toBe("04-01");
    expect(entry!.time).toBe("16:05:35.099");
    expect(entry!.pid).toBe("158");
    expect(entry!.tid).toBe("163");
    expect(entry!.level).toBe(LogLevel.Debug);
    expect(entry!.tag).toBe("dalvikvm");
    expect(entry!.message).toBe("GC_CONCURRENT freed 384K");
  });

  it("should parse Info level", () => {
    const line =
      "03-15 10:22:33.456  1234  1234 I ActivityManager: Starting activity";
    const entry = parseLogcatLine(line);
    expect(entry).toBeDefined();
    expect(entry!.level).toBe(LogLevel.Info);
    expect(entry!.tag).toBe("ActivityManager");
  });

  it("should parse Error level", () => {
    const line =
      "03-15 10:22:33.456  1234  1234 E AndroidRuntime: FATAL EXCEPTION: main";
    const entry = parseLogcatLine(line);
    expect(entry).toBeDefined();
    expect(entry!.level).toBe(LogLevel.Error);
    expect(entry!.tag).toBe("AndroidRuntime");
    expect(entry!.message).toBe("FATAL EXCEPTION: main");
  });

  it("should parse Warning level", () => {
    const line =
      "03-15 10:22:33.456  5678  5678 W System.err: java.io.IOException";
    const entry = parseLogcatLine(line);
    expect(entry!.level).toBe(LogLevel.Warn);
    expect(entry!.tag).toBe("System.err");
  });

  it("should return undefined for non-logcat lines", () => {
    expect(parseLogcatLine("--------- beginning of main")).toBeUndefined();
    expect(parseLogcatLine("")).toBeUndefined();
    expect(parseLogcatLine("random text")).toBeUndefined();
  });

  it("should handle tags with spaces/special chars", () => {
    const line =
      "03-15 10:22:33.456  1234  1234 V My Tag: some message";
    const entry = parseLogcatLine(line);
    expect(entry).toBeDefined();
    expect(entry!.tag).toBe("My Tag");
  });
});
