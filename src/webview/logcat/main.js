// @ts-check
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  const logContainer = document.getElementById("log-container");
  const levelFilter = document.getElementById("level-filter");
  const tagFilter = document.getElementById("tag-filter");
  const packageFilter = document.getElementById("package-filter");
  const searchFilter = document.getElementById("search-filter");
  const clearBtn = document.getElementById("clear-btn");
  const pauseBtn = document.getElementById("pause-btn");

  const MAX_ENTRIES = 10000;
  const LEVEL_ORDER = { V: 0, D: 1, I: 2, W: 3, E: 4, F: 5 };

  /** @type {Array<{entry?: any, raw?: string, element: HTMLElement}>} */
  let entries = [];
  let autoScroll = true;
  let paused = false;

  // Track scroll position for auto-scroll
  logContainer.addEventListener("scroll", () => {
    const { scrollTop, scrollHeight, clientHeight } = logContainer;
    autoScroll = scrollHeight - scrollTop - clientHeight < 50;
  });

  // Filter handlers with debounce
  let filterTimeout;
  function debouncedFilter() {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(applyFilters, 150);
  }

  levelFilter.addEventListener("change", debouncedFilter);
  tagFilter.addEventListener("input", debouncedFilter);
  packageFilter.addEventListener("input", debouncedFilter);
  searchFilter.addEventListener("input", debouncedFilter);

  clearBtn.addEventListener("click", () => {
    entries = [];
    logContainer.innerHTML = "";
    vscode.postMessage({ command: "clear" });
  });

  pauseBtn.addEventListener("click", () => {
    vscode.postMessage({ command: "togglePause" });
  });

  // Messages from extension
  window.addEventListener("message", (event) => {
    const message = event.data;

    switch (message.type) {
      case "logEntry":
        addLogEntry(message.data);
        break;
      case "rawLine":
        addRawLine(message.data);
        break;
      case "clear":
        entries = [];
        logContainer.innerHTML = "";
        break;
      case "pauseState":
        paused = message.data;
        pauseBtn.textContent = paused ? "Resume" : "Pause";
        pauseBtn.classList.toggle("active", paused);
        break;
    }
  });

  function addLogEntry(entry) {
    const el = createLogLine(entry);
    const record = { entry, element: el };
    entries.push(record);

    // Trim buffer
    while (entries.length > MAX_ENTRIES) {
      const removed = entries.shift();
      removed.element.remove();
    }

    // Apply filter before appending
    const visible = matchesFilter(entry);
    el.style.display = visible ? "" : "none";

    logContainer.appendChild(el);
    if (autoScroll) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  function addRawLine(text) {
    const el = document.createElement("div");
    el.className = "raw-line";
    el.textContent = text;

    const record = { raw: text, element: el };
    entries.push(record);

    while (entries.length > MAX_ENTRIES) {
      const removed = entries.shift();
      removed.element.remove();
    }

    logContainer.appendChild(el);
    if (autoScroll) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  function createLogLine(entry) {
    const line = document.createElement("div");
    line.className = `log-line level-${entry.level}`;

    line.innerHTML = `
      <span class="log-time">${entry.time}</span>
      <span class="log-pid">${entry.pid}</span>
      <span class="log-level">${entry.level}</span>
      <span class="log-tag" title="${escapeHtml(entry.tag)}">${escapeHtml(entry.tag)}</span>
      <span class="log-message">${escapeHtml(entry.message)}</span>
    `;

    return line;
  }

  function matchesFilter(entry) {
    // Level filter
    const minLevel = levelFilter.value;
    if (LEVEL_ORDER[entry.level] < LEVEL_ORDER[minLevel]) {
      return false;
    }

    // Tag filter
    const tagVal = tagFilter.value.trim().toLowerCase();
    if (tagVal && !entry.tag.toLowerCase().includes(tagVal)) {
      return false;
    }

    // Package filter (match against PID — simplified)
    const pkgVal = packageFilter.value.trim().toLowerCase();
    if (pkgVal && !entry.tag.toLowerCase().includes(pkgVal) &&
        !entry.message.toLowerCase().includes(pkgVal)) {
      return false;
    }

    // Search filter
    const searchVal = searchFilter.value.trim().toLowerCase();
    if (searchVal) {
      const text = `${entry.tag} ${entry.message}`.toLowerCase();
      if (!text.includes(searchVal)) {
        return false;
      }
    }

    return true;
  }

  function applyFilters() {
    for (const record of entries) {
      if (record.entry) {
        record.element.style.display = matchesFilter(record.entry) ? "" : "none";
      }
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
})();
