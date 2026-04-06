import { buildSearchIndex, filterByIndex } from "../services/search.js";
import { extractListingEntries } from "../utils/domExtractor.js";
import { debounce } from "../utils/debounce.js";
import { highlightMatches, clearHighlight } from "../utils/highlight.js";
import * as storage from "../services/storage.js";
import {
  injectButtonStyles,
  createBookmarkButton,
  createReadButton,
} from "../utils/paperButtons.js";
import type { PaperElementBinding } from "../types/index.js";

/**
 * EventsContentScript - injected on aclanthology.org/events/* pages.
 * Adds search/filter bar and bookmark/read buttons to each paper entry.
 */

type FilterMode = "all" | "unread" | "read";

async function init(): Promise<void> {
  const bindings = extractListingEntries(document);
  if (bindings.length === 0) {
    return;
  }

  // Load storage state
  const bookmarkedIds = new Set<string>();
  const readIds = new Set<string>();

  const bookmarksResult = await storage.getBookmarks();
  if (bookmarksResult.ok) {
    for (const id of Object.keys(bookmarksResult.value)) {
      bookmarkedIds.add(id);
    }
  }

  const readResult = await storage.getReadRecords();
  if (readResult.ok) {
    for (const [id, r] of Object.entries(readResult.value)) {
      if (r.isRead) readIds.add(id);
    }
  }

  // Inject shared button styles
  injectButtonStyles();

  // Add bookmark + read buttons to each entry
  for (const binding of bindings) {
    const textArea = binding.element.querySelector<HTMLElement>("span.d-block");
    if (textArea !== null) {
      const actionRow = document.createElement("div");
      actionRow.className = "acl-tools-action-row";
      actionRow.appendChild(createBookmarkButton(binding.paper, bookmarkedIds));
      actionRow.appendChild(createReadButton(binding.paper, readIds));
      textArea.appendChild(actionRow);
    }
  }

  injectControlBar(bindings, readIds);
}

/**
 * Creates and injects the search + read-filter bar above the paper list.
 */
function injectControlBar(
  bindings: PaperElementBinding[],
  readIds: Set<string>
): void {
  const firstEntry = bindings[0];
  if (firstEntry === undefined) return;

  const parent = firstEntry.element.parentElement;
  if (parent === null) return;

  // ── Read filter bar ────────────────────────────────────────────────────────
  const filterBar = document.createElement("div");
  filterBar.style.cssText = [
    "margin: 8px 0 4px",
    "display: flex",
    "gap: 6px",
    "align-items: center",
    "flex-wrap: wrap",
  ].join(";");

  const filterLabel = document.createElement("span");
  filterLabel.style.cssText = "font-size: 12px; color: #6c757d;";
  filterLabel.textContent = "表示:";
  filterBar.appendChild(filterLabel);

  let filterMode: FilterMode = "all";

  const filterModes: Array<{ mode: FilterMode; label: string }> = [
    { mode: "all", label: "すべて" },
    { mode: "unread", label: "未読のみ" },
    { mode: "read", label: "既読のみ" },
  ];

  const filterBtns: HTMLButtonElement[] = [];
  for (const { mode, label } of filterModes) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText = [
      "padding: 2px 10px",
      "font-size: 12px",
      "border: 1px solid #ced4da",
      "border-radius: 12px",
      "background: #fff",
      "cursor: pointer",
    ].join(";");
    if (mode === "all") {
      btn.style.background = "#0d6efd";
      btn.style.color = "#fff";
      btn.style.borderColor = "#0d6efd";
    }
    btn.addEventListener("click", () => {
      filterMode = mode;
      for (const b of filterBtns) {
        b.style.background = "#fff";
        b.style.color = "";
        b.style.borderColor = "#ced4da";
      }
      btn.style.background = "#0d6efd";
      btn.style.color = "#fff";
      btn.style.borderColor = "#0d6efd";
      applyFilters(input.value, filterMode);
    });
    filterBtns.push(btn);
    filterBar.appendChild(btn);
  }

  // ── Search bar ─────────────────────────────────────────────────────────────
  const searchContainer = document.createElement("div");
  searchContainer.id = "acl-tools-search-container";
  searchContainer.style.cssText = [
    "margin: 4px 0 12px",
    "padding: 8px",
    "background: #f8f9fa",
    "border: 1px solid #dee2e6",
    "border-radius: 4px",
    "display: flex",
    "align-items: center",
    "gap: 8px",
  ].join(";");

  const input = document.createElement("input");
  input.type = "text";
  input.id = "acl-tools-search-input";
  input.placeholder = "論文を検索 (タイトル・著者・アブストラクト)...";
  input.style.cssText = [
    "flex: 1",
    "padding: 6px 10px",
    "border: 1px solid #ced4da",
    "border-radius: 4px",
    "font-size: 14px",
    "outline: none",
  ].join(";");

  const counter = document.createElement("span");
  counter.id = "acl-tools-search-counter";
  counter.style.cssText = [
    "font-size: 13px",
    "color: #6c757d",
    "white-space: nowrap",
    "min-width: 80px",
  ].join(";");
  counter.textContent = `全${bindings.length}件`;

  searchContainer.appendChild(input);
  searchContainer.appendChild(counter);

  // Insert both bars before the first paper entry
  parent.insertBefore(searchContainer, firstEntry.element);
  parent.insertBefore(filterBar, searchContainer);

  // ── Filter logic ───────────────────────────────────────────────────────────
  const papers = bindings.map((b) => b.paper);
  const searchIndex = buildSearchIndex(papers);

  function applyFilters(query: string, mode: FilterMode): void {
    const matchingIndices = filterByIndex(searchIndex, query);

    requestAnimationFrame(() => {
      let visibleCount = 0;

      for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];
        if (binding === undefined) continue;

        const isRead = readIds.has(binding.paper.paperId);
        const matchesRead =
          mode === "all" ||
          (mode === "read" && isRead) ||
          (mode === "unread" && !isRead);
        const matchesSearch = matchingIndices.has(i);
        const visible = matchesSearch && matchesRead;

        const textArea =
          binding.element.querySelector<HTMLElement>("span.d-block");

        if (visible) {
          binding.element.style.removeProperty("display");
          visibleCount++;
          if (textArea !== null) highlightMatches(textArea, query);
        } else {
          binding.element.style.setProperty("display", "none", "important");
          if (textArea !== null) clearHighlight(textArea);
        }
      }

      if (query.trim() === "" && mode === "all") {
        counter.textContent = `全${bindings.length}件`;
      } else {
        counter.textContent = `${visibleCount}件 / 全${bindings.length}件`;
      }
    });
  }

  const handleInput = debounce((): void => {
    applyFilters(input.value, filterMode);
  }, 150);

  input.addEventListener("input", handleInput);
}

// Run after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
} else {
  void init();
}
