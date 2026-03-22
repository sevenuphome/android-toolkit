export enum LogLevel {
  Verbose = "V",
  Debug = "D",
  Info = "I",
  Warn = "W",
  Error = "E",
  Fatal = "F",
}

export interface LogEntry {
  date: string;
  time: string;
  pid: string;
  tid: string;
  level: LogLevel;
  tag: string;
  message: string;
}

export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  [LogLevel.Verbose]: 0,
  [LogLevel.Debug]: 1,
  [LogLevel.Info]: 2,
  [LogLevel.Warn]: 3,
  [LogLevel.Error]: 4,
  [LogLevel.Fatal]: 5,
};

const THREADTIME_REGEX =
  /^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.+?):\s+(.*)$/;

export function parseLogcatLine(line: string): LogEntry | undefined {
  const match = line.match(THREADTIME_REGEX);
  if (!match) {
    return undefined;
  }
  return {
    date: match[1],
    time: match[2],
    pid: match[3],
    tid: match[4],
    level: match[5] as LogLevel,
    tag: match[6].trim(),
    message: match[7],
  };
}
