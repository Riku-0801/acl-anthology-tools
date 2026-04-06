import type { PaperEntry } from "../types/index.js";
import * as storage from "../services/storage.js";

/**
 * Injects shared CSS for action buttons.
 * Idempotent - safe to call multiple times.
 */
export function injectButtonStyles(): void {
  if (document.getElementById("acl-tools-styles")) return;

  const style = document.createElement("style");
  style.id = "acl-tools-styles";
  style.textContent = `
    .acl-tools-btn {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      font-size: 11px;
      border: 1px solid #ced4da;
      border-radius: 3px;
      background: #fff;
      color: #495057;
      cursor: pointer;
      text-decoration: none;
      margin: 0 2px;
      transition: background 0.15s, color 0.15s;
    }
    .acl-tools-btn:hover { background: #e9ecef; }
    .acl-tools-btn.bookmarked {
      background: #fff3cd;
      color: #856404;
      border-color: #ffc107;
    }
    .acl-tools-btn.read {
      background: #d1ecf1;
      color: #0c5460;
      border-color: #bee5eb;
    }
    .acl-tools-action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      margin-top: 4px;
    }
  `;
  document.head.appendChild(style);
}

export function createBookmarkButton(
  paper: PaperEntry,
  bookmarkedIds: Set<string>
): HTMLButtonElement {
  const btn = document.createElement("button");
  updateBookmarkButtonState(btn, bookmarkedIds.has(paper.paperId));

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (bookmarkedIds.has(paper.paperId)) {
      const result = await storage.removeBookmark(paper.paperId);
      if (result.ok) {
        bookmarkedIds.delete(paper.paperId);
        updateBookmarkButtonState(btn, false);
      }
    } else {
      const result = await storage.addBookmark(paper);
      if (result.ok) {
        bookmarkedIds.add(paper.paperId);
        updateBookmarkButtonState(btn, true);
      }
    }
  });

  return btn;
}

export function createReadButton(
  paper: PaperEntry,
  readIds: Set<string>
): HTMLButtonElement {
  const btn = document.createElement("button");
  updateReadButtonState(btn, readIds.has(paper.paperId));

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (readIds.has(paper.paperId)) {
      const result = await storage.markAsUnread(paper.paperId);
      if (result.ok) {
        readIds.delete(paper.paperId);
        updateReadButtonState(btn, false);
      }
    } else {
      const result = await storage.markAsRead(paper.paperId);
      if (result.ok) {
        readIds.add(paper.paperId);
        updateReadButtonState(btn, true);
      }
    }
  });

  return btn;
}

export function updateBookmarkButtonState(
  btn: HTMLButtonElement,
  isBookmarked: boolean
): void {
  if (isBookmarked) {
    btn.textContent = "★ 保存済み";
    btn.className = "acl-tools-btn bookmarked";
    btn.title = "ブックマークを解除";
  } else {
    btn.textContent = "☆ 保存";
    btn.className = "acl-tools-btn";
    btn.title = "ブックマークに追加";
  }
}

export function updateReadButtonState(
  btn: HTMLButtonElement,
  isRead: boolean
): void {
  if (isRead) {
    btn.textContent = "✓ 既読";
    btn.className = "acl-tools-btn read";
    btn.title = "未読に戻す";
  } else {
    btn.textContent = "○ 未読";
    btn.className = "acl-tools-btn";
    btn.title = "既読にする";
  }
}
