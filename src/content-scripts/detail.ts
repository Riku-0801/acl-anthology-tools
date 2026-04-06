import { extractDetailEntry } from "../utils/domExtractor.js";
import * as storage from "../services/storage.js";
import { PAPER_ID_URL_PATTERN } from "../constants/selectors.js";
import {
  injectButtonStyles,
  createBookmarkButton,
  createReadButton,
} from "../utils/paperButtons.js";
import type { PaperEntry } from "../types/index.js";

/**
 * DetailContentScript - injected on ACL Anthology paper detail pages.
 * Provides bookmark management, read/unread tracking, visit tracking, and author side panel.
 */

async function init(): Promise<void> {
  // Check if this is a paper detail page
  const currentUrl = window.location.href;
  if (!PAPER_ID_URL_PATTERN.test(currentUrl)) {
    return;
  }

  const paper = extractDetailEntry(document);
  if (paper === null) return;

  // Record visit
  void storage.markAsVisited(paper.paperId);

  // Load storage state for this paper
  const bookmarkedIds = new Set<string>();
  const readIds = new Set<string>();

  const bookmarksResult = await storage.getBookmarks();
  if (bookmarksResult.ok && paper.paperId in bookmarksResult.value) {
    bookmarkedIds.add(paper.paperId);
  }

  const readResult = await storage.getReadRecords();
  if (readResult.ok) {
    const rec = readResult.value[paper.paperId];
    if (rec?.isRead === true) readIds.add(paper.paperId);
  }

  // Inject styles
  injectStyles();
  injectButtonStyles();

  // Inject header action bar
  injectActionBar(paper, bookmarkedIds, readIds);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById("acl-tools-detail-styles")) return;

  const style = document.createElement("style");
  style.id = "acl-tools-detail-styles";
  style.textContent = `
    #acl-tools-action-bar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin: 12px 0;
      padding: 10px 12px;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
    }
  `;
  document.head.appendChild(style);
}

// ─── Action bar ───────────────────────────────────────────────────────────────

function injectActionBar(
  paper: PaperEntry,
  bookmarkedIds: Set<string>,
  readIds: Set<string>
): void {
  const actionBar = document.createElement("div");
  actionBar.id = "acl-tools-action-bar";

  actionBar.appendChild(createBookmarkButton(paper, bookmarkedIds));
  actionBar.appendChild(createReadButton(paper, readIds));

  // Insert after the title/heading
  const title = document.querySelector("h2#title, h2.title, h1");
  if (title !== null && title.parentElement !== null) {
    title.parentElement.insertBefore(actionBar, title.nextSibling);
  } else {
    const main = document.querySelector("main, #main-content, .container");
    if (main !== null) {
      main.insertBefore(actionBar, main.firstChild);
    } else {
      document.body.insertBefore(actionBar, document.body.firstChild);
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
