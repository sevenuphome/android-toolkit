---
title: "feat: Android Toolkit VSCode Extension"
type: feat
status: active
date: 2026-03-23
origin: docs/brainstorms/2026-03-23-android-toolkit-requirements.md
---

# feat: Android Toolkit VSCode Extension

## Overview

Build and publish "Android Toolkit" — a VSCode extension that brings the essential Android Studio development loop (build, deploy, log) into VSCode. The extension provides a Gradle task runner, device/emulator manager, and Logcat viewer as a single, cohesive experience for Android developers. Published open-source on the VS Code Marketplace under the `sevenuphome` GitHub account.

## Problem Statement

Android developers who prefer VSCode lack a unified set of core development tools. Existing extensions are fragmented across multiple authors, often unmaintained, and don't support modern Android (AGP 8+, Kotlin DSL, Compose). There is no single extension that lets a developer build, deploy to a device, and view logs without leaving the editor. (see origin: docs/brainstorms/2026-03-23-android-toolkit-requirements.md)

## Proposed Solution

A single VSCode extension with three integrated features sharing a common sidebar, status bar, and configuration system:

1. **Gradle Task Runner** — Tree view of discoverable tasks with real-time build output
2. **Device & Emulator Manager** — Tree view of connected devices and AVDs with launch/stop controls
3. **Logcat Viewer** — WebviewView panel with color-coded, filterable log streaming

All features share a core SDK detection layer and cross-platform process management infrastructure.

## Technical Approach

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    extension.ts (entry)                   │
│           Wire providers, register commands               │
└──────────┬──────────────┬──────────────┬─────────────────┘
           │              │              │
    ┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼──────┐
    │   Gradle    │ │  Device   │ │  Logcat    │
    │  Provider   │ │ Provider  │ │  Provider  │
    │ (TreeData)  │ │ (TreeData)│ │(WebviewView│
    └──────┬──────┘ └─────┬─────┘ └─────┬──────┘
           │              │              │
    ┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼──────┐
    │   Gradle    │ │   ADB     │ │  Logcat    │
    │  Service    │ │  Service  │ │  Service   │
    └──────┬──────┘ └─────┬─────┘ └─────┬──────┘
           │              │              │
    ┌──────▼──────────────▼──────────────▼──────┐
    │           Process Manager                  │
    │    (spawn, track, kill child processes)     │
    └──────────────────┬────────────────────────┘
                       │
    ┌──────────────────▼────────────────────────┐
    │         SDK / Platform Utilities           │
    │  (path detection, cross-platform exec)     │
    └───────────────────────────────────────────┘
```

**Key architectural decisions:**

- **Providers vs Services separation** — Providers handle VSCode UI (TreeDataProvider, WebviewViewProvider). Services handle business logic (spawning processes, parsing output). Services have zero `vscode` imports, making them independently testable.
- **Shared ProcessManager** — Central registry of all spawned child processes with cross-platform kill support (uses `tree-kill` on Windows to avoid orphaned processes).
- **Shared SDK detection** — Single utility that resolves `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `local.properties`, and OS defaults. Used by all services.
- **Event-driven integration** — Device selection fires an event consumed by Logcat (to filter by package) and Status Bar (to update display). Gradle build completion fires an event consumed by Status Bar.

### Technology Stack

- **Language:** TypeScript (strict mode)
- **Build:** esbuild (fast bundling, officially recommended)
- **Test:** Vitest for unit tests, `@vscode/test-cli` + `@vscode/test-electron` for integration tests
- **Linting:** ESLint with TypeScript rules
- **Minimum VSCode:** `^1.85.0`
- **Node dependency:** `tree-kill` (cross-platform process tree killing)

### Project Structure

```
android-toolkit/
├── .vscode/
│   ├── launch.json              # Extension Host debug config
│   └── tasks.json               # Build/watch tasks
├── src/
│   ├── extension.ts             # Entry: activate() / deactivate()
│   ├── commands/
│   │   ├── gradle.ts            # Gradle command handlers
│   │   ├── device.ts            # Device command handlers
│   │   └── logcat.ts            # Logcat command handlers
│   ├── providers/
│   │   ├── gradleTaskProvider.ts # TreeDataProvider for Gradle tasks
│   │   ├── deviceTreeProvider.ts # TreeDataProvider for devices/emulators
│   │   └── logcatViewProvider.ts # WebviewViewProvider for Logcat
│   ├── services/
│   │   ├── gradleService.ts     # Gradle task discovery & execution
│   │   ├── adbService.ts        # ADB device listing & commands
│   │   ├── emulatorService.ts   # AVD listing, launch, stop
│   │   ├── logcatService.ts     # Logcat streaming & parsing
│   │   └── processManager.ts    # Central child process lifecycle
│   ├── models/
│   │   ├── gradleTask.ts        # GradleTask, TaskGroup interfaces
│   │   ├── device.ts            # Device, Emulator interfaces
│   │   └── logEntry.ts          # LogEntry, LogLevel types
│   ├── utils/
│   │   ├── sdk.ts               # Android SDK path detection
│   │   ├── platform.ts          # Cross-platform exec helpers
│   │   └── config.ts            # Extension settings accessor
│   └── webview/
│       └── logcat/
│           ├── index.html       # Logcat viewer HTML shell
│           ├── main.js          # Logcat viewer logic (filter, scroll, color)
│           └── style.css        # Theme-aware styling using CSS variables
├── test/
│   ├── unit/
│   │   ├── gradleService.test.ts
│   │   ├── adbService.test.ts
│   │   ├── emulatorService.test.ts
│   │   ├── logcatService.test.ts
│   │   └── sdk.test.ts
│   ├── integration/
│   │   └── suite/
│   │       └── extension.test.ts
│   └── fixtures/
│       └── sample-project/      # Minimal Android project for testing
│           ├── build.gradle.kts
│           ├── settings.gradle.kts
│           └── gradlew
├── media/
│   ├── icon.png                 # Marketplace icon (128x128+)
│   ├── android-toolkit.svg      # Activity bar icon
│   ├── gradle.svg               # Gradle tree item icon
│   └── device.svg               # Device tree item icon
├── package.json                 # Extension manifest
├── tsconfig.json
├── esbuild.mjs                  # Build script
├── .vscodeignore
├── .eslintrc.json
├── CHANGELOG.md
├── README.md
└── LICENSE                      # MIT
```

### Implementation Phases

#### Phase 1: Foundation (Scaffolding + SDK Detection)

**Goal:** Working extension skeleton that activates on Android projects, detects SDK, and shows an empty sidebar.

**Tasks:**
- [ ] Initialize project with `yo code` (TypeScript template, esbuild bundler) — `package.json`, `tsconfig.json`, `esbuild.mjs`
- [ ] Configure `package.json` manifest:
  - Publisher: `sevenuphome`
  - Activation events: `workspaceContains:**/build.gradle`, `workspaceContains:**/build.gradle.kts`
  - View container: `android-toolkit` on activity bar
  - Empty views: `gradleTasks`, `deviceManager`
  - Configuration: `androidToolkit.sdkPath`, `androidToolkit.javaHome`, `androidToolkit.adbPath`
- [ ] Implement `src/utils/sdk.ts` — SDK path detection:
  1. Check extension setting `androidToolkit.sdkPath`
  2. Check `ANDROID_HOME` env var
  3. Check `ANDROID_SDK_ROOT` env var
  4. Read `local.properties` from workspace root (`sdk.dir=...`)
  5. Check OS defaults: macOS `~/Library/Android/sdk`, Linux `~/Android/Sdk`, Windows `%LOCALAPPDATA%\Android\Sdk`
  6. Validate by checking `platform-tools/adb` exists
- [ ] Implement `src/utils/platform.ts` — cross-platform helpers:
  - `getExecutableName(base)` → appends `.exe` on Windows, handles `gradlew` → `gradlew.bat`
  - `getGradleWrapper(workspaceRoot)` → resolves `./gradlew` or `gradlew.bat`
  - `getAdbPath(sdkPath)` → `<sdk>/platform-tools/adb[.exe]`
  - `getEmulatorPath(sdkPath)` → `<sdk>/emulator/emulator[.exe]`
- [ ] Implement `src/services/processManager.ts` — central process lifecycle:
  - `spawn(command, args, options)` → spawns and tracks child process
  - `kill(id)` → kills process tree (uses `tree-kill` on Windows)
  - `killAll()` → kills all tracked processes (called from `deactivate()`)
  - Implements `Disposable` for `context.subscriptions`
- [ ] Implement `src/utils/config.ts` — typed settings accessor wrapping `workspace.getConfiguration('androidToolkit')`
- [ ] Wire `extension.ts`:
  - Detect SDK on activation, show warning if not found with link to settings
  - Register empty tree views
  - Push all disposables to `context.subscriptions`
- [ ] Set up ESLint, Vitest, basic CI with GitHub Actions
- [ ] Unit tests for SDK detection (mock env vars and filesystem)

**Success criteria:** Extension activates when opening an Android project. Sidebar icon appears. SDK path is detected and logged. Settings page shows configuration options.

#### Phase 2: Gradle Task Runner (R1)

**Goal:** Discover and run Gradle tasks with real-time output.

**Tasks:**
- [ ] Implement `src/models/gradleTask.ts`:
  - `GradleTask` interface: `name`, `description`, `group`, `modulePath`, `fullTaskPath`
  - `TaskGroup` interface: `name`, `tasks[]`
- [ ] Implement `src/services/gradleService.ts`:
  - `discoverTasks(workspaceRoot)` → runs `./gradlew tasks --all --console=plain`, parses output
    - Parse group headers: line followed by `---` dashes
    - Parse task lines: `^(\S+) - (.+)$`
    - Handle multi-module: prefix tasks with module path
  - `discoverModules(workspaceRoot)` → parse `settings.gradle[.kts]` for `include` statements
    - Regex: `include\s*\(?['":]+([^'"]+)['"]`
    - Fallback: run `./gradlew projects --console=plain`
  - `runTask(taskPath, workspaceRoot)` → spawn Gradle with `--console=plain`
    - Stream stdout to OutputChannel
    - Detect build outcome: `BUILD SUCCESSFUL` / `BUILD FAILED`
    - Support cancellation via `CancellationToken`
  - `isGradleProject(workspaceRoot)` → check for `gradlew` or `gradlew.bat`
- [ ] Implement `src/providers/gradleTaskProvider.ts` (TreeDataProvider):
  - Root level: task groups (collapsible) or modules (if multi-module)
  - Child level: individual tasks with run icon
  - `contextValue`: `"gradleTask"` for menu contributions
  - Click handler: runs the task
  - Refresh button in view title
  - Welcome view when no Gradle project detected
- [ ] Implement `src/commands/gradle.ts`:
  - `androidToolkit.runGradleTask` — run selected task
  - `androidToolkit.refreshGradleTasks` — refresh task tree
  - `androidToolkit.stopGradleBuild` — cancel running build
- [ ] Create OutputChannel `"Android Toolkit: Gradle"` for build output
  - `show(true)` on build start (preserve focus)
  - `clear()` before each build
  - Stream stdout/stderr line by line
- [ ] Register FileSystemWatcher for `**/*.gradle`, `**/*.gradle.kts` — debounced refresh (500ms)
- [ ] Unit tests: task output parsing, module detection, build outcome detection

**Success criteria:** Open an Android project → Gradle Tasks tree shows all available tasks grouped by category → Click a task → build output streams in Output panel → Build result (success/failure) is clear.

#### Phase 3: Device & Emulator Manager (R2)

**Goal:** List devices and emulators, launch/stop emulators, select deployment target.

**Tasks:**
- [ ] Implement `src/models/device.ts`:
  - `AndroidDevice` interface: `serial`, `state`, `type` (physical/emulator), `model`, `apiLevel`, `product`
  - `AvdEmulator` interface: `name`, `running` (boolean), `serial` (if running)
- [ ] Implement `src/services/adbService.ts`:
  - `listDevices()` → run `adb devices -l`, parse output
    - Skip header line, split by `\t`, parse long-format properties
    - Map serial numbers starting with `emulator-` as emulator type
  - `getDeviceProperty(serial, prop)` → run `adb -s <serial> shell getprop <prop>`
  - `installApk(serial, apkPath)` → run `adb -s <serial> install -r <apk>`
    - Parse `Success` / `Failure [CODE]` from output
  - `startDeviceTracking()` → poll `adb devices` every 3 seconds (or use `adb track-devices` if feasible)
    - Fire event on device list change
- [ ] Implement `src/services/emulatorService.ts`:
  - `listAvds()` → run `emulator -list-avds`, split output by newline
  - `launchEmulator(avdName)` → spawn `emulator @<avdName>` (long-running, background)
    - Track process in ProcessManager
    - Poll `adb -s <serial> shell getprop sys.boot_completed` until `1`
    - Fire event when boot completes
  - `stopEmulator(serial)` → run `adb -s <serial> emu kill`
  - `isEmulatorRunning(avdName)` → cross-reference AVD names with running emulator serials
- [ ] Implement `src/providers/deviceTreeProvider.ts` (TreeDataProvider):
  - Section 1: "Connected Devices" — physical + running emulators
    - Show: model, API level, state (device/offline/unauthorized)
    - Icon: phone for physical, monitor for emulator
    - Context value: `"connectedDevice"`
  - Section 2: "Available Emulators" — AVDs not currently running
    - Show: AVD name
    - Context value: `"availableEmulator"`
  - Click handler: select as active device
  - Context menu actions: "Launch" (emulators), "Stop" (running emulators)
  - Auto-refresh on device list change events
  - Welcome view: "No devices connected. Connect a device via USB or launch an emulator."
- [ ] Implement `src/commands/device.ts`:
  - `androidToolkit.refreshDevices` — force refresh
  - `androidToolkit.selectDevice` — set active device (stores serial)
  - `androidToolkit.launchEmulator` — launch AVD
  - `androidToolkit.stopEmulator` — stop running emulator
  - `androidToolkit.installApk` — install APK to active device (pick file dialog)
- [ ] Implement active device tracking:
  - Store selected device serial in `workspaceState`
  - Fire `onDidChangeActiveDevice` event (consumed by Logcat and Status Bar)
  - Auto-select if only one device connected
  - Clear selection if device disconnects
- [ ] Unit tests: ADB output parsing, device list diffing, emulator state tracking

**Success criteria:** Open project → Devices tree shows connected devices and available emulators → Launch an emulator from tree → See it appear in connected devices when booted → Select device as active target → Status bar updates.

#### Phase 4: Logcat Viewer (R3)

**Goal:** Stream and filter Logcat output in a rich, interactive panel.

**Tasks:**
- [ ] Implement `src/models/logEntry.ts`:
  - `LogEntry` interface: `date`, `time`, `pid`, `tid`, `level` (V/D/I/W/E/F), `tag`, `message`
  - `LogLevel` enum: Verbose, Debug, Info, Warn, Error, Fatal
  - Level-to-color mapping for webview
- [ ] Implement `src/services/logcatService.ts`:
  - `startStreaming(serial, options?)` → spawn `adb -s <serial> logcat -v threadtime`
    - Parse each line with regex: `^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+(.+?):\s+(.*)$`
    - Fire `onLogEntry` event for each parsed entry
    - Handle unparseable lines (stack traces, multi-line messages) by attaching to previous entry
  - `stopStreaming()` → kill logcat process
  - `clearLog()` → restart logcat stream (or `adb logcat -c` to clear device buffer)
  - `getRunningPackage(serial)` → run `adb -s <serial> shell dumpsys activity activities` and parse for top resumed activity package
- [ ] Implement `src/providers/logcatViewProvider.ts` (WebviewViewProvider):
  - Register as `androidToolkit.logcatView` in bottom panel
  - Set `retainContextWhenHidden: true` (preserve scroll and filter state)
  - Load `src/webview/logcat/index.html` with proper CSP and nonce
  - Handle messages from webview:
    - `setFilter` → update tag/package/level/text filter
    - `clear` → clear log and restart
    - `togglePause` → pause/resume streaming
  - Post messages to webview:
    - `logEntry` → new log line to render
    - `clear` → clear display
  - Auto-start streaming when active device is set
  - Restart streaming on active device change
- [ ] Build `src/webview/logcat/index.html`:
  - Toolbar: log level dropdown, tag filter input, package filter input, search input, clear button, pause/resume toggle
  - Log area: virtual-scrolled list of log entries
  - Each line: timestamp, PID, TID, level badge (color-coded), tag, message
  - Color scheme using VSCode CSS variables (`--vscode-editor-foreground`, etc.):
    - Verbose: gray
    - Debug: blue
    - Info: green
    - Warn: yellow/orange
    - Error: red
    - Fatal: red bold
  - Client-side filtering for instant response (filter already-received entries)
  - Auto-scroll to bottom (with "scroll lock" when user scrolls up)
- [ ] Build `src/webview/logcat/main.js`:
  - Receive log entries via `postMessage`
  - Maintain in-memory buffer (cap at ~10,000 entries to avoid memory issues)
  - Apply filters client-side for instant feedback
  - Handle pause/resume (buffer entries while paused, render on resume)
- [ ] Build `src/webview/logcat/style.css`:
  - Theme-aware using `vscode-light`/`vscode-dark` body classes
  - Monospace font for log entries
  - Compact line height for density
  - Sticky toolbar
- [ ] Implement `src/commands/logcat.ts`:
  - `androidToolkit.showLogcat` — focus/open Logcat panel
  - `androidToolkit.clearLogcat` — clear log
  - `androidToolkit.toggleLogcatPause` — pause/resume
- [ ] Unit tests: logcat line parsing, filter logic, buffer management

**Success criteria:** Select a device → Logcat panel shows streaming logs color-coded by level → Filter by tag/package/level reduces visible entries → Pause stops new entries (buffers them) → Resume shows buffered entries → Clear resets the view.

#### Phase 5: Status Bar + Integration + Polish (R5)

**Goal:** Unified status bar, cross-feature integration, and marketplace readiness.

**Tasks:**
- [ ] Implement Status Bar items:
  - Device indicator: `$(device-mobile) Pixel 7 (API 34)` — click opens device picker
  - Build status: `$(loading~spin)` during build, `$(check) Build OK` / `$(error) Build Failed` after
  - Hide when no Android project detected
- [ ] Wire cross-feature integration:
  - Device selection → Logcat auto-switches to that device's stream
  - Device selection → sets target for `adb install` in Gradle post-build
  - Gradle "installDebug" success → optionally launch app on device
  - Device disconnect → stop Logcat stream, update status bar, notify user
- [ ] Add "Run on device" compound command:
  - `androidToolkit.buildAndRun` — runs `assembleDebug` + `installDebug` + launches app + starts Logcat
  - Keyboard shortcut: configurable, suggest `Ctrl+F5` / `Cmd+F5`
- [ ] Polish for marketplace:
  - Write README.md with screenshots, feature list, requirements, configuration
  - Write CHANGELOG.md
  - Create marketplace icon (128x128 PNG)
  - Create activity bar icon (SVG)
  - Set `package.json` marketplace metadata: `categories`, `keywords`, `galleryBanner`
  - Configure `.vscodeignore` for minimal VSIX size
- [ ] Configuration for `onDidChangeConfiguration`:
  - React to SDK path changes without restart
  - React to ADB path changes
- [ ] Error handling polish:
  - SDK not found: informative notification with "Open Settings" action
  - ADB not found: check SDK path, suggest installing platform-tools
  - Gradle wrapper not found: suggest `gradle wrapper` or download
  - Device unauthorized: show "Check your device for a USB debugging authorization dialog"
  - Emulator launch failure: show emulator stderr output
- [ ] Cross-platform testing checklist:
  - macOS: test with Homebrew-installed SDK and Android Studio SDK
  - Linux: test with default paths
  - Windows: test `gradlew.bat`, path separators, process killing
- [ ] Set up GitHub Actions CI:
  - Build + lint + unit tests on push
  - Integration tests with `xvfb-run` on Linux
  - VSIX packaging on release tags
- [ ] Publish to VS Code Marketplace via `vsce publish`

**Success criteria:** Full build-deploy-log cycle works end-to-end. Status bar shows current state. Extension installs cleanly from Marketplace. README has screenshots. Works on macOS, Linux, Windows.

## System-Wide Impact

### Interaction Graph

Extension activation → SDK detection → (success) register all providers and commands; (failure) show warning, register commands with degraded state. Device change event → Logcat restarts stream → Status bar updates text. Gradle build complete → Status bar updates → (if installDebug) trigger APK install → (if launch enabled) start app → Logcat auto-filters to package.

### Error & Failure Propagation

All child process errors caught at ProcessManager level. Services translate process errors into typed results (success/failure with reason). Providers translate service errors into user-facing notifications via `vscode.window.showErrorMessage()` with action buttons. No silent failures — every error path produces visible feedback.

### State Lifecycle Risks

- **Orphaned processes:** ProcessManager tracks all spawned processes; `deactivate()` calls `killAll()`. Windows uses `tree-kill` for process trees.
- **Stale device list:** Polling interval (3s) means up to 3s staleness. Acceptable for device connect/disconnect.
- **Logcat buffer overflow:** Client-side buffer capped at 10,000 entries. Oldest entries dropped.
- **Concurrent builds:** Only one Gradle build at a time per workspace. Second build attempt shows "Build already in progress" with cancel option.

### API Surface Parity

All features accessible via:
1. Tree view interactions (click, context menu)
2. Command palette (`Ctrl+Shift+P`)
3. Keyboard shortcuts (configurable)
4. Status bar clicks

## Acceptance Criteria

### Functional Requirements
- [ ] Extension activates when opening a folder containing `build.gradle` or `build.gradle.kts`
- [ ] Gradle tasks tree shows all tasks grouped by category for single and multi-module projects
- [ ] Running a Gradle task shows real-time output in Output channel
- [ ] Device tree shows connected physical devices with model and API level
- [ ] Device tree shows available AVD emulators with launch action
- [ ] Launching an emulator from the tree starts it and adds it to connected devices when booted
- [ ] Logcat panel streams color-coded log entries from the active device
- [ ] Logcat filtering by tag, package, level, and free text works
- [ ] Logcat pause/resume and clear work correctly
- [ ] Status bar shows active device name and build status
- [ ] "Build and Run" command executes full build-deploy-log cycle
- [ ] All features work on macOS, Linux, and Windows

### Non-Functional Requirements
- [ ] Extension activates in < 500ms (lazy-load heavy operations)
- [ ] VSIX package size < 500KB (esbuild bundling, proper `.vscodeignore`)
- [ ] No memory leaks: all disposables cleaned up, all processes killed on deactivate
- [ ] Logcat viewer handles sustained high-throughput logging without freezing

### Quality Gates
- [ ] Unit test coverage for all services (parsing, detection, state management)
- [ ] Integration tests for extension activation and command registration
- [ ] ESLint clean with zero warnings
- [ ] README with screenshots, feature list, and configuration docs
- [ ] CHANGELOG follows Keep a Changelog format

## Dependencies & Prerequisites

- **Node.js** ≥ 18 (for development)
- **VSCode** ≥ 1.85.0 (runtime)
- **Android SDK** on user's machine (with ADB and emulator)
- **npm packages:** `tree-kill` (runtime), `@vscode/vsce` (dev), `vitest` (dev), `esbuild` (dev), `@types/vscode` (dev), `@vscode/test-cli` (dev), `@vscode/test-electron` (dev)
- **Azure DevOps PAT** for Marketplace publishing (with "Marketplace > Manage" scope)
- **GitHub repo:** `sevenuphome/android-toolkit`

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Gradle task parsing breaks on unusual output | Medium | Low | Use `--console=plain`, test with diverse projects, fallback to raw output |
| Emulator boot detection unreliable | Low | Medium | Poll multiple properties (`sys.boot_completed` + `init.svc.bootanim`), configurable timeout |
| Windows process orphaning | Medium | Medium | Use `tree-kill` package, test on Windows CI |
| Logcat high-throughput freezes webview | Medium | Medium | Cap buffer at 10K entries, batch DOM updates, virtual scrolling |
| Extension name conflict on Marketplace | Low | High | Check availability before publishing, have backup name ready |
| ADB version incompatibilities | Low | Low | Target ADB output format from platform-tools 30+ (widely available) |

## Alternative Approaches Considered

1. **Multiple separate extensions** — One per feature (logcat, gradle, devices). Rejected: fragmented UX, harder to share state like active device selection. (see origin: docs/brainstorms/2026-03-23-android-toolkit-requirements.md — user explicitly wants a cohesive experience)

2. **Language Server Protocol** — Run Android tooling as a language server. Rejected: LSP is designed for language features (completion, diagnostics), not build/device management. Overengineered for this use case.

3. **Webview-only UI** — Build entire UI as a single webview instead of native tree views. Rejected: tree views integrate better with VSCode's native look and feel, support keyboard navigation, and follow platform conventions.

## Future Considerations

Post-v1 features (from origin document scope boundaries):
- APK Analyzer — inspect APK contents, sizes, dex files
- Lint integration — inline warnings and quick fixes
- Compose Preview — render `@Preview` composables in editor
- Profiling — basic CPU/memory profiling integration
- Code templates — scaffold new Activities, Fragments, ViewModels

## Sources & References

### Origin
- **Origin document:** [docs/brainstorms/2026-03-23-android-toolkit-requirements.md](docs/brainstorms/2026-03-23-android-toolkit-requirements.md) — Key decisions: name "Android Toolkit", focused v1 scope (build/device/logcat), open-source on sevenuphome GitHub, TypeScript

### VSCode Extension Development
- [Official VS Code Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)
- [Tree View API Guide](https://code.visualstudio.com/api/extension-guides/tree-view)
- [Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [Publishing Extensions Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Bundling with esbuild](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)
- [Activation Events Reference](https://code.visualstudio.com/api/references/activation-events)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)

### Android CLI Tools
- [Android Debug Bridge (adb)](https://developer.android.com/tools/adb)
- [Logcat Command-Line Tool](https://developer.android.com/tools/logcat)
- [Start the Emulator from Command Line](https://developer.android.com/studio/run/emulator-commandline)
- [Android Environment Variables](https://developer.android.com/tools/variables)
- [Gradle Command-Line Interface](https://docs.gradle.org/current/userguide/command_line_interface.html)
