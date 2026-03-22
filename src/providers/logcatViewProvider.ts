import * as vscode from "vscode";
import { LogEntry } from "../models/logEntry";
import { LogcatService } from "../services/logcatService";
import { getLogcatBufferSize } from "../utils/config";

export class LogcatViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private paused = false;
  private pauseBuffer: LogEntry[] = [];

  constructor(
    private extensionUri: vscode.Uri,
    private logcatService: LogcatService
  ) {
    this.logcatService.onLogEntry((entry: LogEntry) => {
      if (this.paused) {
        this.pauseBuffer.push(entry);
        if (this.pauseBuffer.length > getLogcatBufferSize()) {
          this.pauseBuffer.shift();
        }
      } else {
        this.postMessage({ type: "logEntry", data: entry });
      }
    });

    this.logcatService.onRawLine((line: string) => {
      if (!this.paused) {
        this.postMessage({ type: "rawLine", data: line });
      }
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "setFilter":
          // Filters are applied client-side in the webview
          break;
        case "clear":
          this.pauseBuffer = [];
          break;
        case "togglePause":
          this.togglePause();
          break;
      }
    });
  }

  togglePause(): void {
    this.paused = !this.paused;
    if (!this.paused && this.pauseBuffer.length > 0) {
      // Flush buffered entries
      for (const entry of this.pauseBuffer) {
        this.postMessage({ type: "logEntry", data: entry });
      }
      this.pauseBuffer = [];
    }
    this.postMessage({ type: "pauseState", data: this.paused });
  }

  clear(): void {
    this.pauseBuffer = [];
    this.postMessage({ type: "clear" });
  }

  startStreaming(serial: string): void {
    this.logcatService.startStreaming(serial);
  }

  stopStreaming(): void {
    this.logcatService.stopStreaming();
  }

  private postMessage(message: unknown): void {
    this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "src", "webview", "logcat", "style.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "src", "webview", "logcat", "main.js")
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Logcat</title>
</head>
<body>
  <div id="toolbar">
    <select id="level-filter">
      <option value="V">Verbose</option>
      <option value="D">Debug</option>
      <option value="I" selected>Info</option>
      <option value="W">Warn</option>
      <option value="E">Error</option>
    </select>
    <input id="tag-filter" type="text" placeholder="Filter by tag...">
    <input id="package-filter" type="text" placeholder="Filter by package...">
    <input id="search-filter" type="text" placeholder="Search...">
    <button id="clear-btn" title="Clear">Clear</button>
    <button id="pause-btn" title="Pause/Resume">Pause</button>
  </div>
  <div id="log-container"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
