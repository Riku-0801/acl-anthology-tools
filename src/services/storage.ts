import type {
  BookmarkEntry,
  ExtensionSettings,
  PaperEntry,
  ReadRecord,
  Result,
  StorageError,
  StorageSchema,
} from "../types/index.js";
import { STORAGE_WARNING_BYTES } from "../constants/selectors.js";

const DEFAULT_SETTINGS: ExtensionSettings = {
  abstractPreviewEnabled: true,
};

/**
 * Reads typed data from chrome.storage.local.
 */
async function readStorage<K extends keyof StorageSchema>(
  key: K
): Promise<Result<StorageSchema[K], StorageError>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: {
            kind: "read_error",
            message: chrome.runtime.lastError.message ?? "Read error",
          },
        });
        return;
      }
      resolve({ ok: true, value: result[key] as StorageSchema[K] });
    });
  });
}

/**
 * Writes typed data to chrome.storage.local.
 */
async function writeStorage<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K]
): Promise<Result<void, StorageError>> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message ?? "";
        if (msg.toLowerCase().includes("quota")) {
          resolve({
            ok: false,
            error: { kind: "quota_exceeded", message: msg },
          });
        } else {
          resolve({
            ok: false,
            error: { kind: "write_error", message: msg },
          });
        }
        return;
      }
      resolve({ ok: true, value: undefined });
    });
  });
}

/**
 * Checks storage usage and returns a warning if near the limit.
 */
async function checkStorageCapacity(): Promise<Result<void, StorageError>> {
  return new Promise((resolve) => {
    chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: true, value: undefined }); // Non-fatal
        return;
      }
      if (bytesInUse >= STORAGE_WARNING_BYTES) {
        resolve({
          ok: false,
          error: {
            kind: "quota_exceeded",
            message: `Storage usage (${bytesInUse} bytes) exceeds warning threshold (${STORAGE_WARNING_BYTES} bytes)`,
          },
        });
      } else {
        resolve({ ok: true, value: undefined });
      }
    });
  });
}

// ─── Bookmark operations ────────────────────────────────────────────────────

export async function getBookmarks(): Promise<
  Result<Record<string, BookmarkEntry>, StorageError>
> {
  const result = await readStorage("bookmarks");
  if (!result.ok) return result;
  return { ok: true, value: result.value ?? {} };
}

export async function addBookmark(
  paper: PaperEntry
): Promise<Result<void, StorageError>> {
  const capacityResult = await checkStorageCapacity();
  if (!capacityResult.ok) return capacityResult;

  const existing = await getBookmarks();
  if (!existing.ok) return existing;

  const entry: BookmarkEntry = {
    paperId: paper.paperId,
    savedAt: new Date().toISOString(),
    paper,
  };

  const updated: Record<string, BookmarkEntry> = {
    ...existing.value,
    [paper.paperId]: entry,
  };

  return writeStorage("bookmarks", updated);
}

export async function removeBookmark(
  paperId: string
): Promise<Result<void, StorageError>> {
  const existing = await getBookmarks();
  if (!existing.ok) return existing;

  const updated = { ...existing.value };
  delete updated[paperId];

  return writeStorage("bookmarks", updated);
}

export async function isBookmarked(paperId: string): Promise<boolean> {
  const result = await getBookmarks();
  if (!result.ok) return false;
  return paperId in result.value;
}

// ─── Read record operations ──────────────────────────────────────────────────

export async function getReadRecords(): Promise<
  Result<Record<string, ReadRecord>, StorageError>
> {
  const result = await readStorage("readRecords");
  if (!result.ok) return result;
  return { ok: true, value: result.value ?? {} };
}

export async function markAsRead(
  paperId: string
): Promise<Result<void, StorageError>> {
  const existing = await getReadRecords();
  if (!existing.ok) return existing;

  const current = existing.value[paperId];
  const record = buildReadRecord(paperId, true, new Date().toISOString(), current?.visitedAt);

  const updated: Record<string, ReadRecord> = {
    ...existing.value,
    [paperId]: record,
  };

  return writeStorage("readRecords", updated);
}

export async function markAsUnread(
  paperId: string
): Promise<Result<void, StorageError>> {
  const existing = await getReadRecords();
  if (!existing.ok) return existing;

  const current = existing.value[paperId];
  const record = buildReadRecord(paperId, false, undefined, current?.visitedAt);

  const updated: Record<string, ReadRecord> = {
    ...existing.value,
    [paperId]: record,
  };

  return writeStorage("readRecords", updated);
}

export async function markAsVisited(
  paperId: string
): Promise<Result<void, StorageError>> {
  const existing = await getReadRecords();
  if (!existing.ok) return existing;

  const current = existing.value[paperId];
  // Don't overwrite visitedAt if already set
  if (current?.visitedAt !== undefined) {
    return { ok: true, value: undefined };
  }

  const record = buildReadRecord(
    paperId,
    current?.isRead ?? false,
    current?.markedReadAt,
    new Date().toISOString()
  );

  const updated: Record<string, ReadRecord> = {
    ...existing.value,
    [paperId]: record,
  };

  return writeStorage("readRecords", updated);
}

/**
 * Builds a ReadRecord, only setting optional properties when defined.
 * Satisfies exactOptionalPropertyTypes.
 */
function buildReadRecord(
  paperId: string,
  isRead: boolean,
  markedReadAt: string | undefined,
  visitedAt: string | undefined
): ReadRecord {
  const record: { -readonly [K in keyof ReadRecord]?: ReadRecord[K] } = {
    paperId,
    isRead,
  };
  if (markedReadAt !== undefined) {
    record.markedReadAt = markedReadAt;
  }
  if (visitedAt !== undefined) {
    record.visitedAt = visitedAt;
  }
  return record as ReadRecord;
}

// ─── Settings operations ─────────────────────────────────────────────────────

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await readStorage("settings");
  if (!result.ok || result.value === undefined) {
    return DEFAULT_SETTINGS;
  }
  return { ...DEFAULT_SETTINGS, ...result.value };
}

export async function updateSettings(
  patch: Partial<ExtensionSettings>
): Promise<Result<void, StorageError>> {
  const current = await getSettings();
  const updated: ExtensionSettings = { ...current, ...patch };
  return writeStorage("settings", updated);
}

// ─── Export functions ─────────────────────────────────────────────────────────

export async function exportBookmarksAsJSON(): Promise<string> {
  const result = await getBookmarks();
  if (!result.ok) return "[]";
  const bookmarks = Object.values(result.value);
  return JSON.stringify(bookmarks, null, 2);
}

export async function exportReadRecordsAsCSV(): Promise<string> {
  const result = await getReadRecords();
  if (!result.ok) return "paperId,isRead,markedReadAt,visitedAt\n";

  const header = "paperId,isRead,markedReadAt,visitedAt";
  const rows = Object.values(result.value).map((record) => {
    const escapedId = `"${record.paperId.replace(/"/g, '""')}"`;
    const isRead = record.isRead ? "true" : "false";
    const markedReadAt = record.markedReadAt ?? "";
    const visitedAt = record.visitedAt ?? "";
    return `${escapedId},${isRead},${markedReadAt},${visitedAt}`;
  });

  return [header, ...rows].join("\n");
}
