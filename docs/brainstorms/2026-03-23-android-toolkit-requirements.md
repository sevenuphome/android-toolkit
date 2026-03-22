---
date: 2026-03-23
topic: android-toolkit-vscode
---

# Android Toolkit — VSCode Extension

## Problem Frame

Android developers who prefer VSCode over Android Studio lack a cohesive set of core development tools — Gradle build management, device/emulator control, and Logcat viewing. Existing extensions are fragmented, often unmaintained, and don't provide an integrated experience. Android Toolkit brings the essential Android Studio development loop into VSCode as a single, polished extension published on the VS Code Marketplace.

## Requirements

- R1. **Gradle Task Runner** — Discover and run Gradle tasks (build, clean, assemble, install, custom tasks) from a tree view panel. Show real-time build output in an integrated output channel with progress indication. Support multi-module projects.
- R2. **Device & Emulator Manager** — List connected physical devices and available AVD emulators in a tree view. Launch/stop emulators. Select a target device for deployment. Show device properties (API level, model, status). Uses ADB and AVD manager under the hood.
- R3. **Logcat Viewer** — Stream Logcat output in a dedicated panel with color-coded log levels (Verbose, Debug, Info, Warn, Error). Support filtering by tag, package name, log level, and free-text search. Clear and pause/resume log stream. Auto-detect running app package.
- R4. **Cross-Platform Support** — Work on macOS, Linux, and Windows. Auto-detect Android SDK and ADB paths, with manual override in settings.
- R5. **Status Bar Integration** — Show active device and build status in the VSCode status bar for quick visibility.

## Success Criteria

- A developer can open an Android project in VSCode, build it, deploy to a device/emulator, and view logs — all without leaving the editor
- Extension installs cleanly from the VS Code Marketplace with zero configuration for standard SDK setups
- Works with modern Android projects (AGP 8+, Kotlin DSL, Compose projects)

## Scope Boundaries

- **Not v1:** APK Analyzer, Lint integration, profiling, app inspection
- **Not v1:** UI preview (Compose Preview, Layout Inspector)
- **Not v1:** Code generation, templates, or scaffolding
- **Not v1:** Debugging (breakpoints, step-through) — VSCode already has basic Android debug support via other extensions
- **Out of scope:** Replacing Android Studio entirely — this is a focused toolkit for the core build-run-log loop

## Key Decisions

- **Name:** Android Toolkit — clear, discoverable, describes a collection of tools
- **Audience:** Open-source, published to VS Code Marketplace under the `sevenuphome` GitHub account
- **Technology:** TypeScript, VSCode Extension API
- **Scope strategy:** Ship a focused v1 (build, device, logcat) rather than a thin spread across many features
- **Repo:** `sevenuphome/android-toolkit` on GitHub

## Dependencies / Assumptions

- Users have Android SDK installed with `ANDROID_HOME` or `ANDROID_SDK_ROOT` set (or configurable in settings)
- ADB is available on PATH or SDK platform-tools
- Gradle wrapper (`gradlew`) is present in the project root
- AVD emulators are created via Android Studio or `avdmanager` CLI

## Outstanding Questions

### Resolve Before Planning

_(none — all product decisions resolved)_

### Deferred to Planning

- [Affects R1][Needs research] Best approach for parsing Gradle task list — invoke `gradlew tasks` or parse build files?
- [Affects R2][Technical] How to detect AVD emulator list — use `emulator -list-avds` or parse AVD directory?
- [Affects R3][Needs research] Logcat streaming approach — spawn `adb logcat` process or use ADB protocol directly?
- [Affects R4][Technical] Strategy for auto-detecting SDK paths across macOS, Linux, and Windows
- [Affects R5][Technical] Extension activation strategy — activate on Android project detection or on-demand?

## Next Steps

→ `/ce:plan` for structured implementation planning
