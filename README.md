# Android Toolkit

Bring the essential Android Studio development loop to VS Code — build, deploy, and view logs without leaving your editor.

## Features

### Gradle Task Runner
- Discover and run Gradle tasks from the sidebar
- Real-time build output with progress
- Multi-module project support
- Build cancellation

### Device & Emulator Manager
- List connected physical devices and AVD emulators
- Launch and stop emulators
- Select target device for deployment
- Auto-detect device connections

### Logcat Viewer
- Color-coded log streaming by level (Verbose, Debug, Info, Warn, Error)
- Filter by tag, package name, log level, and free-text search
- Pause/resume and clear controls
- Auto-follows selected device

### Status Bar Integration
- Active device indicator
- Build status display
- One-click device selection

## Quick Start

1. Install the extension
2. Open an Android project in VS Code
3. The Android Toolkit sidebar appears automatically
4. Select a device and start building!

**Keyboard shortcut:** `Cmd+F5` / `Ctrl+F5` — Build and Run

## Requirements

- Android SDK with `ANDROID_HOME` environment variable set
- ADB (included in Android SDK platform-tools)
- Gradle wrapper (`gradlew`) in your project

## Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `androidToolkit.sdkPath` | Path to Android SDK | Auto-detected |
| `androidToolkit.javaHome` | Path to JDK | Auto-detected |
| `androidToolkit.adbPath` | Path to ADB executable | Auto-detected |
| `androidToolkit.logcatBufferSize` | Max Logcat entries in memory | 10000 |
| `androidToolkit.devicePollingInterval` | Device polling interval (ms) | 3000 |

## License

MIT
