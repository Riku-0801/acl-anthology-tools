// Result type for error handling without exceptions
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Core data models
export interface PaperEntry {
  readonly paperId: string; // ACL ID e.g. "2024.acl-long.1"
  readonly title: string;
  readonly authors: readonly string[];
  readonly abstract?: string;
  readonly pdfUrl?: string;
  readonly bibUrl: string;
  readonly pageUrl: string;
}

export interface BookmarkEntry {
  readonly paperId: string;
  readonly savedAt: string; // ISO 8601
  readonly paper: PaperEntry;
}

export interface ReadRecord {
  readonly paperId: string;
  readonly isRead: boolean;
  readonly markedReadAt?: string;
  readonly visitedAt?: string;
}

export interface ExtensionSettings {
  readonly abstractPreviewEnabled: boolean;
}

export interface AuthorCacheEntry {
  readonly authorSlug: string;
  readonly recentPapers: readonly PaperEntry[];
  readonly cachedAt: string; // ISO 8601
}

export interface StorageSchema {
  bookmarks: Record<string, BookmarkEntry>;
  readRecords: Record<string, ReadRecord>;
  settings: ExtensionSettings;
  authorCache: Record<string, AuthorCacheEntry>;
}

export interface PaperElementBinding {
  paper: PaperEntry;
  element: HTMLElement;
}

// Error types
export interface StorageError {
  kind: "quota_exceeded" | "read_error" | "write_error";
  message: string;
}

export interface BibtexError {
  kind: "fetch_failed" | "clipboard_denied" | "not_found";
  message: string;
}

export interface AuthorError {
  kind: "fetch_failed" | "parse_failed";
  message: string;
}

// Message Protocol for Service Worker
export type MessageRequest =
  | { action: "FETCH_BIBTEX"; bibUrl: string }
  | { action: "FETCH_AUTHOR_PAPERS"; authorSlug: string; maxCount: number };

export type MessageResponse<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
