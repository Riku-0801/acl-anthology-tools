import type { PaperElementBinding, PaperEntry } from "../types/index.js";
import { extractListingEntries } from "../utils/domExtractor.js";
import * as storage from "../services/storage.js";
import * as authorService from "../services/author.js";
import {
  injectButtonStyles,
  createBookmarkButton,
  createReadButton,
} from "../utils/paperButtons.js";

/**
 * ListingContentScript - injected on all non-events ACL Anthology pages.
 * Provides BibTeX copy buttons, PDF buttons, abstract preview,
 * bookmark management, read tracking, and author popups.
 */

// ─── Global state ─────────────────────────────────────────────────────────────

let currentPopup: HTMLElement | null = null;
let settings = { abstractPreviewEnabled: true };
let bookmarkedIds = new Set<string>();
let readIds = new Set<string>();
let bindings: PaperElementBinding[] = [];

// ─── Initialization ───────────────────────────────────────────────────────────

async function init(): Promise<void> {
  bindings = extractListingEntries(document);
  if (bindings.length === 0) return;

  // Load settings and storage state
  settings = await storage.getSettings();

  const bookmarksResult = await storage.getBookmarks();
  if (bookmarksResult.ok) {
    bookmarkedIds = new Set(Object.keys(bookmarksResult.value));
  }

  const readResult = await storage.getReadRecords();
  if (readResult.ok) {
    readIds = new Set(
      Object.entries(readResult.value)
        .filter(([, r]) => r.isRead)
        .map(([id]) => id)
    );
  }

  // Inject styles
  injectButtonStyles();
  injectListingStyles();

  // Process each paper entry
  for (const binding of bindings) {
    enhancePaperEntry(binding);
  }

  // Inject filter controls
  injectFilterControls();

  // Close popup on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopup();
  });

  document.addEventListener("click", (e) => {
    if (
      currentPopup !== null &&
      !currentPopup.contains(e.target as Node)
    ) {
      closePopup();
    }
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function injectListingStyles(): void {
  if (document.getElementById("acl-tools-listing-styles")) return;

  const style = document.createElement("style");
  style.id = "acl-tools-listing-styles";
  style.textContent = `
    .acl-tools-popup {
      position: fixed;
      z-index: 99999;
      background: #fff;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      padding: 12px;
      max-width: 480px;
      max-height: 400px;
      overflow-y: auto;
      font-size: 13px;
      line-height: 1.5;
    }
    .acl-tools-popup .popup-title {
      font-weight: bold;
      margin-bottom: 6px;
      font-size: 14px;
    }
    .acl-tools-popup .popup-authors {
      color: #6c757d;
      margin-bottom: 8px;
    }
    .acl-tools-popup .popup-abstract {
      color: #343a40;
      margin-bottom: 8px;
      max-height: 200px;
      overflow-y: auto;
    }
    .acl-tools-popup .popup-actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .acl-tools-visited {
      opacity: 0.7;
    }
    .acl-tools-read-mark {
      text-decoration: line-through;
      opacity: 0.6;
    }
    .acl-tools-filter-bar {
      margin: 10px 0;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .acl-tools-filter-btn {
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid #ced4da;
      border-radius: 12px;
      background: #fff;
      cursor: pointer;
    }
    .acl-tools-filter-btn.active {
      background: #0d6efd;
      color: #fff;
      border-color: #0d6efd;
    }
    .acl-tools-author-popup {
      position: fixed;
      z-index: 99998;
      background: #fff;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      padding: 10px;
      max-width: 380px;
      font-size: 12px;
    }
    .skeleton-line {
      height: 12px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
      margin: 4px 0;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Paper entry enhancement ──────────────────────────────────────────────────

function enhancePaperEntry(binding: PaperElementBinding): void {
  const { paper, element } = binding;

  // Create action row with bookmark + read buttons
  const actionRow = document.createElement("div");
  actionRow.className = "acl-tools-action-row";
  actionRow.appendChild(createBookmarkButton(paper, bookmarkedIds));
  actionRow.appendChild(createReadButton(paper, readIds));

  // Append to span.d-block (title/authors container)
  const textArea = element.querySelector<HTMLElement>("span.d-block");
  if (textArea !== null) {
    textArea.appendChild(actionRow);
  } else {
    element.appendChild(actionRow);
  }

  // Abstract preview hover on title
  if (settings.abstractPreviewEnabled) {
    const titleEl = element.querySelector<HTMLElement>("strong > a.align-middle");
    if (titleEl !== null) {
      setupAbstractHover(titleEl, paper, actionRow);
    }
  }

  // Author hover popups (author links are plain <a href="/people/..."> with no class)
  const authorEls = element.querySelectorAll<HTMLAnchorElement>("a[href*='/people/']");
  for (const authorEl of authorEls) {
    setupAuthorHover(authorEl);
  }
}


// ─── Abstract popup ───────────────────────────────────────────────────────────

function setupAbstractHover(
  titleEl: HTMLElement,
  paper: PaperEntry,
  actionRow: HTMLElement
): void {
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

  titleEl.addEventListener("mouseenter", () => {
    hoverTimeout = setTimeout(() => {
      showAbstractPopup(titleEl, paper, actionRow);
    }, 300);
  });

  titleEl.addEventListener("mouseleave", (e) => {
    if (hoverTimeout !== null) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    // Don't close if moving to popup itself
    const related = e.relatedTarget as HTMLElement | null;
    if (
      currentPopup !== null &&
      related !== null &&
      currentPopup.contains(related)
    ) {
      return;
    }
    // Small delay to allow moving to popup
    setTimeout(() => {
      if (
        currentPopup !== null &&
        !currentPopup.matches(":hover")
      ) {
        closePopup();
      }
    }, 200);
  });
}

function showAbstractPopup(
  anchor: HTMLElement,
  paper: PaperEntry,
  actionRow: HTMLElement
): void {
  closePopup();

  const popup = document.createElement("div");
  popup.className = "acl-tools-popup";

  // Title
  const titleEl = document.createElement("div");
  titleEl.className = "popup-title";
  titleEl.textContent = paper.title;
  popup.appendChild(titleEl);

  // Authors
  if (paper.authors.length > 0) {
    const authorsEl = document.createElement("div");
    authorsEl.className = "popup-authors";
    authorsEl.textContent = paper.authors.join(", ");
    popup.appendChild(authorsEl);
  }

  // Abstract
  const abstractEl = document.createElement("div");
  abstractEl.className = "popup-abstract";

  if (paper.abstract !== undefined) {
    abstractEl.textContent = paper.abstract;
  } else {
    // Show skeleton and fetch async
    const skeleton1 = document.createElement("div");
    skeleton1.className = "skeleton-line";
    skeleton1.style.width = "100%";
    const skeleton2 = document.createElement("div");
    skeleton2.className = "skeleton-line";
    skeleton2.style.width = "85%";
    const skeleton3 = document.createElement("div");
    skeleton3.className = "skeleton-line";
    skeleton3.style.width = "70%";
    abstractEl.appendChild(skeleton1);
    abstractEl.appendChild(skeleton2);
    abstractEl.appendChild(skeleton3);

    // Async fetch
    void fetchAbstractAsync(paper.pageUrl, abstractEl);
  }

  popup.appendChild(abstractEl);

  // Action buttons
  const actionsEl = document.createElement("div");
  actionsEl.className = "popup-actions";
  actionsEl.appendChild(createBookmarkButton(paper, bookmarkedIds));
  actionsEl.appendChild(createReadButton(paper, readIds));
  popup.appendChild(actionsEl);

  // Position the popup
  document.body.appendChild(popup);
  positionPopup(popup, anchor);

  currentPopup = popup;

  popup.addEventListener("mouseleave", () => {
    closePopup();
  });
}

async function fetchAbstractAsync(
  pageUrl: string,
  container: HTMLElement
): Promise<void> {
  try {
    const response = await fetch(pageUrl);
    if (!response.ok) {
      container.textContent = "アブストラクトを取得できませんでした。";
      return;
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const abstractEl = doc.querySelector<HTMLElement>(".acl-abstract p");
    const text = abstractEl?.textContent?.trim() ?? "";

    if (text !== "") {
      container.textContent = text;
    } else {
      container.textContent = "アブストラクトが見つかりませんでした。";
    }
  } catch {
    container.textContent = "アブストラクトを取得できませんでした。";
  }
}

function positionPopup(popup: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const popupWidth = 480;
  const margin = 8;

  let left = rect.left;
  let top = rect.bottom + margin;

  // Adjust if popup would go off screen
  if (left + popupWidth > window.innerWidth) {
    left = window.innerWidth - popupWidth - margin;
  }
  if (left < margin) left = margin;

  // If popup would go below viewport, show above
  if (top + 300 > window.innerHeight) {
    top = rect.top - 300 - margin;
    if (top < margin) top = margin;
  }

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

function closePopup(): void {
  if (currentPopup !== null) {
    currentPopup.remove();
    currentPopup = null;
  }
}

// ─── Author hover popup ───────────────────────────────────────────────────────

function setupAuthorHover(authorEl: HTMLAnchorElement): void {
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  let authorPopup: HTMLElement | null = null;

  authorEl.addEventListener("mouseenter", () => {
    hoverTimeout = setTimeout(async () => {
      authorPopup = createAuthorPopup(authorEl);
      document.body.appendChild(authorPopup);
      positionPopup(authorPopup, authorEl);

      // Extract slug from href e.g. /people/john-doe/
      const href = authorEl.getAttribute("href") ?? "";
      const match = /\/people\/([^/]+)\/?/.exec(href);
      const slug = match?.[1];

      if (slug === undefined) {
        setAuthorPopupContent(authorPopup, null, authorEl.textContent ?? "");
        return;
      }

      const result = await authorService.getRecentPapers(slug, 5);
      if (authorPopup !== null) {
        if (result.ok) {
          setAuthorPopupContent(
            authorPopup,
            result.value,
            authorEl.textContent ?? "",
            href
          );
        } else {
          setAuthorPopupContent(authorPopup, null, authorEl.textContent ?? "", href);
        }
      }
    }, 500);
  });

  authorEl.addEventListener("mouseleave", (e) => {
    if (hoverTimeout !== null) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    const related = e.relatedTarget as HTMLElement | null;
    if (
      authorPopup !== null &&
      related !== null &&
      authorPopup.contains(related)
    ) {
      return;
    }
    setTimeout(() => {
      if (authorPopup !== null && !authorPopup.matches(":hover")) {
        authorPopup.remove();
        authorPopup = null;
      }
    }, 200);
  });
}

function createAuthorPopup(anchor: HTMLElement): HTMLElement {
  const popup = document.createElement("div");
  popup.className = "acl-tools-author-popup";

  // Skeleton loading state
  const loading = document.createElement("div");
  loading.textContent = "著者情報を取得中...";
  loading.style.color = "#6c757d";
  popup.appendChild(loading);

  popup.addEventListener("mouseleave", () => {
    popup.remove();
  });

  return popup;
}

function setAuthorPopupContent(
  popup: HTMLElement,
  papers: readonly import("../types/index.js").PaperEntry[] | null,
  authorName: string,
  authorHref?: string
): void {
  popup.textContent = "";

  const header = document.createElement("div");
  header.style.cssText = "font-weight:bold;margin-bottom:6px;";
  header.textContent = authorName;
  popup.appendChild(header);

  if (papers === null || papers.length === 0) {
    const msg = document.createElement("div");
    msg.textContent = "情報を取得できませんでした。";
    msg.style.color = "#6c757d";
    popup.appendChild(msg);

    if (authorHref !== undefined) {
      const link = document.createElement("a");
      link.href = authorHref;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "著者ページを見る →";
      link.style.fontSize = "11px";
      popup.appendChild(link);
    }
    return;
  }

  const list = document.createElement("ul");
  list.style.cssText = "margin:0;padding-left:16px;";

  for (const paper of papers) {
    const item = document.createElement("li");
    item.style.marginBottom = "4px";

    const link = document.createElement("a");
    link.href = paper.pageUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = paper.title;
    link.style.fontSize = "12px";

    item.appendChild(link);
    list.appendChild(item);
  }

  popup.appendChild(list);

  if (authorHref !== undefined) {
    const allLink = document.createElement("a");
    allLink.href = authorHref;
    allLink.target = "_blank";
    allLink.rel = "noopener noreferrer";
    allLink.textContent = "全著作を見る →";
    allLink.style.cssText = "display:block;margin-top:6px;font-size:11px;";
    popup.appendChild(allLink);
  }
}

// ─── Read/unread filter ───────────────────────────────────────────────────────

type FilterMode = "all" | "unread" | "read";

function injectFilterControls(): void {
  const firstBinding = bindings[0];
  if (firstBinding === undefined) return;

  const parent = firstBinding.element.parentElement;
  if (parent === null) return;

  const bar = document.createElement("div");
  bar.className = "acl-tools-filter-bar";

  const label = document.createElement("span");
  label.style.fontSize = "12px";
  label.style.color = "#6c757d";
  label.textContent = "表示:";
  bar.appendChild(label);

  const modes: Array<{ mode: FilterMode; label: string }> = [
    { mode: "all", label: "すべて" },
    { mode: "unread", label: "未読のみ" },
    { mode: "read", label: "既読のみ" },
  ];

  let currentMode: FilterMode = "all";

  for (const { mode, label: btnLabel } of modes) {
    const btn = document.createElement("button");
    btn.className = "acl-tools-filter-btn";
    if (mode === "all") btn.classList.add("active");
    btn.textContent = btnLabel;

    btn.addEventListener("click", () => {
      currentMode = mode;

      // Update button states
      const allBtns = bar.querySelectorAll<HTMLButtonElement>(
        ".acl-tools-filter-btn"
      );
      for (const b of allBtns) {
        b.classList.remove("active");
      }
      btn.classList.add("active");

      // Apply filter
      applyReadFilter(currentMode);
    });

    bar.appendChild(btn);
  }

  parent.insertBefore(bar, firstBinding.element);
}

function applyReadFilter(mode: FilterMode): void {
  for (const binding of bindings) {
    const { paper, element } = binding;
    const isRead = readIds.has(paper.paperId);

    let shouldShow = true;
    if (mode === "unread") shouldShow = !isRead;
    if (mode === "read") shouldShow = isRead;

    if (shouldShow) {
      element.style.removeProperty("display");
    } else {
      element.style.setProperty("display", "none", "important");
    }
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
} else {
  void init();
}
