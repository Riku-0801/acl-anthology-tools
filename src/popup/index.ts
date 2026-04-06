import * as storage from "../services/storage.js";
import type { BookmarkEntry } from "../types/index.js";

// ─── Tab management ───────────────────────────────────────────────────────────

function initTabs(): void {
  const tabBtns = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  const tabContents = document.querySelectorAll<HTMLElement>(".tab-content");

  for (const btn of tabBtns) {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      if (targetTab === null) return;

      // Deactivate all
      for (const b of tabBtns) b.classList.remove("active");
      for (const c of tabContents) c.classList.remove("active");

      // Activate selected
      btn.classList.add("active");
      const targetEl = document.getElementById(`tab-${targetTab}`);
      if (targetEl !== null) targetEl.classList.add("active");
    });
  }
}

// ─── Bookmark list ────────────────────────────────────────────────────────────

async function renderBookmarks(): Promise<void> {
  const listEl = document.getElementById("bookmarks-list");
  const emptyEl = document.getElementById("bookmarks-empty");
  const countEl = document.getElementById("bookmark-count");
  if (listEl === null || emptyEl === null) return;

  const result = await storage.getBookmarks();
  if (!result.ok) {
    listEl.textContent = "ブックマークの読み込みに失敗しました。";
    return;
  }

  const bookmarks = Object.values(result.value).sort((a, b) =>
    b.savedAt.localeCompare(a.savedAt)
  );

  if (countEl !== null) {
    countEl.textContent = String(bookmarks.length);
  }

  if (bookmarks.length === 0) {
    emptyEl.style.display = "flex";
    listEl.textContent = "";
    return;
  }

  emptyEl.style.display = "none";
  listEl.textContent = "";

  for (const bookmark of bookmarks) {
    const item = createBookmarkItem(bookmark, () => {
      void renderBookmarks();
    });
    listEl.appendChild(item);
  }
}

function createBookmarkItem(
  bookmark: BookmarkEntry,
  onRemove: () => void
): HTMLElement {
  const item = document.createElement("div");
  item.className = "bookmark-item";

  // Title
  const titleEl = document.createElement("div");
  titleEl.className = "bm-title";
  titleEl.textContent = bookmark.paper.title;
  titleEl.title = bookmark.paper.title;
  item.appendChild(titleEl);

  // Authors
  if (bookmark.paper.authors.length > 0) {
    const authorsEl = document.createElement("div");
    authorsEl.className = "bm-authors";
    authorsEl.textContent = bookmark.paper.authors.join(", ");
    item.appendChild(authorsEl);
  }

  // Meta row
  const metaEl = document.createElement("div");
  metaEl.className = "bm-meta";

  const dateEl = document.createElement("span");
  dateEl.className = "bm-date";
  dateEl.textContent = formatDate(bookmark.savedAt);
  metaEl.appendChild(dateEl);

  const removeBtn = document.createElement("button");
  removeBtn.className = "bm-remove";
  removeBtn.textContent = "削除";
  removeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await storage.removeBookmark(bookmark.paperId);
    onRemove();
  });
  metaEl.appendChild(removeBtn);

  item.appendChild(metaEl);

  // Click opens paper page
  item.addEventListener("click", () => {
    chrome.tabs.create({ url: bookmark.paper.pageUrl });
  });

  return item;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return isoString;
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

async function initSettings(): Promise<void> {
  const toggle = document.getElementById(
    "toggle-abstract-preview"
  ) as HTMLInputElement | null;
  if (toggle === null) return;

  const settings = await storage.getSettings();
  toggle.checked = settings.abstractPreviewEnabled;

  toggle.addEventListener("change", () => {
    void storage.updateSettings({ abstractPreviewEnabled: toggle.checked });
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function initExportButtons(): void {
  const exportBookmarksBtn = document.getElementById("btn-export-bookmarks");
  const exportReadsBtn = document.getElementById("btn-export-reads");

  if (exportBookmarksBtn !== null) {
    exportBookmarksBtn.addEventListener("click", async () => {
      const json = await storage.exportBookmarksAsJSON();
      const timestamp = new Date().toISOString().split("T")[0] ?? "export";
      downloadFile(json, `acl-bookmarks-${timestamp}.json`, "application/json");
    });
  }

  if (exportReadsBtn !== null) {
    exportReadsBtn.addEventListener("click", async () => {
      const csv = await storage.exportReadRecordsAsCSV();
      const timestamp = new Date().toISOString().split("T")[0] ?? "export";
      downloadFile(csv, `acl-reads-${timestamp}.csv`, "text/csv");
    });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  initTabs();
  await Promise.all([renderBookmarks(), initSettings()]);
  initExportButtons();
}

void main();
