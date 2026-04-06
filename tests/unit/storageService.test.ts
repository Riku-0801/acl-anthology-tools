import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PaperEntry } from "../../src/types/index.js";

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    local: {
      get: vi.fn((key: string, callback: (result: Record<string, unknown>) => void) => {
        callback({ [key]: mockStorage[key] });
      }),
      set: vi.fn((items: Record<string, unknown>, callback: () => void) => {
        for (const [k, v] of Object.entries(items)) {
          mockStorage[k] = v;
        }
        callback();
      }),
      getBytesInUse: vi.fn((_key: null, callback: (bytes: number) => void) => {
        callback(0);
      }),
    },
  },
  runtime: {
    lastError: undefined as chrome.runtime.LastError | undefined,
  },
};

vi.stubGlobal("chrome", chromeMock);

// Import after mocking
const { getBookmarks, addBookmark, removeBookmark, isBookmarked,
        getReadRecords, markAsRead, markAsVisited, getSettings,
        updateSettings, exportBookmarksAsJSON, exportReadRecordsAsCSV } =
  await import("../../src/services/storage.js");

const makePaper = (overrides: Partial<PaperEntry> = {}): PaperEntry => ({
  paperId: "2024.acl-long.1",
  title: "Test Paper",
  authors: ["Alice Smith"],
  bibUrl: "https://aclanthology.org/2024.acl-long.1.bib",
  pageUrl: "https://aclanthology.org/2024.acl-long.1/",
  ...overrides,
});

describe("StorageService - bookmarks", () => {
  beforeEach(() => {
    // Clear mock storage
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
    // Re-wire mocks
    chromeMock.storage.local.get.mockImplementation(
      (key: string, callback: (result: Record<string, unknown>) => void) => {
        callback({ [key]: mockStorage[key] });
      }
    );
    chromeMock.storage.local.set.mockImplementation(
      (items: Record<string, unknown>, callback: () => void) => {
        for (const [k, v] of Object.entries(items)) {
          mockStorage[k] = v;
        }
        callback();
      }
    );
    chromeMock.storage.local.getBytesInUse.mockImplementation(
      (_key: null, callback: (bytes: number) => void) => {
        callback(0);
      }
    );
    chromeMock.runtime.lastError = undefined;
  });

  it("returns empty bookmarks initially", async () => {
    const result = await getBookmarks();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value)).toHaveLength(0);
    }
  });

  it("adds a bookmark successfully", async () => {
    const paper = makePaper();
    const result = await addBookmark(paper);
    expect(result.ok).toBe(true);

    const bookmarks = await getBookmarks();
    expect(bookmarks.ok).toBe(true);
    if (bookmarks.ok) {
      expect(bookmarks.value[paper.paperId]).toBeDefined();
      expect(bookmarks.value[paper.paperId]!.paper.title).toBe(paper.title);
    }
  });

  it("sets savedAt as ISO 8601 string when adding bookmark", async () => {
    const paper = makePaper();
    await addBookmark(paper);

    const bookmarks = await getBookmarks();
    if (bookmarks.ok) {
      const entry = bookmarks.value[paper.paperId];
      expect(entry).toBeDefined();
      expect(new Date(entry!.savedAt).toISOString()).toBe(entry!.savedAt);
    }
  });

  it("removes a bookmark", async () => {
    const paper = makePaper();
    await addBookmark(paper);

    const removeResult = await removeBookmark(paper.paperId);
    expect(removeResult.ok).toBe(true);

    const bookmarks = await getBookmarks();
    if (bookmarks.ok) {
      expect(bookmarks.value[paper.paperId]).toBeUndefined();
    }
  });

  it("isBookmarked returns true for bookmarked paper", async () => {
    const paper = makePaper();
    await addBookmark(paper);
    const result = await isBookmarked(paper.paperId);
    expect(result).toBe(true);
  });

  it("isBookmarked returns false for non-bookmarked paper", async () => {
    const result = await isBookmarked("non-existent-id");
    expect(result).toBe(false);
  });

  it("isBookmarked returns false after removal", async () => {
    const paper = makePaper();
    await addBookmark(paper);
    await removeBookmark(paper.paperId);
    const result = await isBookmarked(paper.paperId);
    expect(result).toBe(false);
  });
});

describe("StorageService - read records", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
    chromeMock.storage.local.get.mockImplementation(
      (key: string, callback: (result: Record<string, unknown>) => void) => {
        callback({ [key]: mockStorage[key] });
      }
    );
    chromeMock.storage.local.set.mockImplementation(
      (items: Record<string, unknown>, callback: () => void) => {
        for (const [k, v] of Object.entries(items)) {
          mockStorage[k] = v;
        }
        callback();
      }
    );
    chromeMock.runtime.lastError = undefined;
  });

  it("returns empty read records initially", async () => {
    const result = await getReadRecords();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value)).toHaveLength(0);
    }
  });

  it("marks paper as read", async () => {
    const result = await markAsRead("2024.acl-long.1");
    expect(result.ok).toBe(true);

    const records = await getReadRecords();
    if (records.ok) {
      const record = records.value["2024.acl-long.1"];
      expect(record).toBeDefined();
      expect(record!.isRead).toBe(true);
      expect(record!.markedReadAt).toBeDefined();
    }
  });

  it("sets markedReadAt as ISO 8601 string", async () => {
    await markAsRead("2024.acl-long.1");
    const records = await getReadRecords();
    if (records.ok) {
      const record = records.value["2024.acl-long.1"];
      expect(record!.markedReadAt).toBeDefined();
      expect(new Date(record!.markedReadAt!).toISOString()).toBe(
        record!.markedReadAt
      );
    }
  });

  it("marks paper as visited", async () => {
    const result = await markAsVisited("2024.acl-long.1");
    expect(result.ok).toBe(true);

    const records = await getReadRecords();
    if (records.ok) {
      const record = records.value["2024.acl-long.1"];
      expect(record).toBeDefined();
      expect(record!.visitedAt).toBeDefined();
    }
  });

  it("does not overwrite visitedAt on second visit", async () => {
    await markAsVisited("2024.acl-long.1");
    const records1 = await getReadRecords();
    const firstVisit =
      records1.ok ? records1.value["2024.acl-long.1"]?.visitedAt : undefined;

    await markAsVisited("2024.acl-long.1");
    const records2 = await getReadRecords();
    const secondVisit =
      records2.ok ? records2.value["2024.acl-long.1"]?.visitedAt : undefined;

    expect(firstVisit).toBe(secondVisit);
  });
});

describe("StorageService - settings", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
    chromeMock.storage.local.get.mockImplementation(
      (key: string, callback: (result: Record<string, unknown>) => void) => {
        callback({ [key]: mockStorage[key] });
      }
    );
    chromeMock.storage.local.set.mockImplementation(
      (items: Record<string, unknown>, callback: () => void) => {
        for (const [k, v] of Object.entries(items)) {
          mockStorage[k] = v;
        }
        callback();
      }
    );
    chromeMock.runtime.lastError = undefined;
  });

  it("returns default settings when not set", async () => {
    const settings = await getSettings();
    expect(settings.abstractPreviewEnabled).toBe(true);
  });

  it("updates settings", async () => {
    await updateSettings({ abstractPreviewEnabled: false });
    const settings = await getSettings();
    expect(settings.abstractPreviewEnabled).toBe(false);
  });
});

describe("StorageService - exports", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
    chromeMock.storage.local.get.mockImplementation(
      (key: string, callback: (result: Record<string, unknown>) => void) => {
        callback({ [key]: mockStorage[key] });
      }
    );
    chromeMock.storage.local.set.mockImplementation(
      (items: Record<string, unknown>, callback: () => void) => {
        for (const [k, v] of Object.entries(items)) {
          mockStorage[k] = v;
        }
        callback();
      }
    );
    chromeMock.storage.local.getBytesInUse.mockImplementation(
      (_key: null, callback: (bytes: number) => void) => {
        callback(0);
      }
    );
    chromeMock.runtime.lastError = undefined;
  });

  it("exports bookmarks as valid JSON", async () => {
    const paper = makePaper();
    await addBookmark(paper);

    const json = await exportBookmarksAsJSON();
    const parsed = JSON.parse(json) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });

  it("exports empty bookmarks as empty JSON array", async () => {
    const json = await exportBookmarksAsJSON();
    const parsed = JSON.parse(json) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });

  it("exports read records as CSV with header", async () => {
    await markAsRead("2024.acl-long.1");
    const csv = await exportReadRecordsAsCSV();
    expect(csv).toContain("paperId,isRead,markedReadAt,visitedAt");
    expect(csv).toContain("2024.acl-long.1");
    expect(csv).toContain("true");
  });

  it("exports empty read records as CSV with only header", async () => {
    const csv = await exportReadRecordsAsCSV();
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("paperId,isRead,markedReadAt,visitedAt");
  });
});
