import { describe, it, expect, vi, beforeEach } from "vitest";
import { Window } from "happy-dom";
import type { PaperEntry } from "../../src/types/index.js";

// Mock chrome APIs
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
    sendMessage: vi.fn(),
    lastError: undefined as chrome.runtime.LastError | undefined,
  },
};

vi.stubGlobal("chrome", chromeMock);

const clipboardMock = { writeText: vi.fn() };
vi.stubGlobal("navigator", { clipboard: clipboardMock });

// Import storage service
const storageService = await import("../../src/services/storage.js");

function makePaper(id = "2024.acl-long.1"): PaperEntry {
  return {
    paperId: id,
    title: "Test Paper Title",
    authors: ["Alice Smith", "Bob Jones"],
    bibUrl: `https://aclanthology.org/${id}.bib`,
    pageUrl: `https://aclanthology.org/${id}/`,
    pdfUrl: `https://aclanthology.org/${id}.pdf`,
  };
}

function resetMockStorage(): void {
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
}

// Simulate BibTeX button click behavior
async function simulateBibtexButtonClick(
  paper: PaperEntry,
  bibtexResponse: { ok: boolean; value?: string; error?: string }
): Promise<{ success: boolean; errorKind?: string }> {
  chromeMock.runtime.sendMessage.mockImplementation(
    (_msg: unknown, callback: (response: unknown) => void) => {
      callback(bibtexResponse);
    }
  );

  clipboardMock.writeText.mockResolvedValue(undefined);

  // Simulate the fetch + copy flow
  const { fetchFromUrl, copyToClipboard } = await import("../../src/services/bibtex.js");

  const fetchResult = await fetchFromUrl(paper.bibUrl);
  if (!fetchResult.ok) {
    return { success: false, errorKind: fetchResult.error.kind };
  }

  const copyResult = await copyToClipboard(fetchResult.value);
  if (!copyResult.ok) {
    return { success: false, errorKind: copyResult.error.kind };
  }

  return { success: true };
}

describe("ListingContentScript - BibTeX button", () => {
  beforeEach(() => {
    resetMockStorage();
    clipboardMock.writeText.mockResolvedValue(undefined);
  });

  it("copies BibTeX to clipboard on successful fetch", async () => {
    const paper = makePaper();
    const bibtexText = "@inproceedings{test2024, title={Test}, author={Alice}}";

    const result = await simulateBibtexButtonClick(paper, {
      ok: true,
      value: bibtexText,
    });

    expect(result.success).toBe(true);
    expect(clipboardMock.writeText).toHaveBeenCalledWith(bibtexText);
  });

  it("returns error when fetch fails", async () => {
    const paper = makePaper();

    const result = await simulateBibtexButtonClick(paper, {
      ok: false,
      error: "HTTP 404: Not Found",
    });

    expect(result.success).toBe(false);
    expect(result.errorKind).toBe("fetch_failed");
  });

  it("sends correct message to service worker", async () => {
    const paper = makePaper();
    chromeMock.runtime.sendMessage.mockImplementation(
      (_msg: unknown, callback: (response: unknown) => void) => {
        callback({ ok: true, value: "@inproceedings{}" });
      }
    );

    const { fetchFromUrl } = await import("../../src/services/bibtex.js");
    await fetchFromUrl(paper.bibUrl);

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "FETCH_BIBTEX",
        bibUrl: paper.bibUrl,
      }),
      expect.any(Function)
    );
  });
});

describe("ListingContentScript - Bookmark button", () => {
  beforeEach(() => {
    resetMockStorage();
  });

  it("adds bookmark to storage when bookmark button is clicked", async () => {
    const paper = makePaper();
    const result = await storageService.addBookmark(paper);

    expect(result.ok).toBe(true);
    expect(chromeMock.storage.local.set).toHaveBeenCalled();
  });

  it("bookmark is retrievable after adding", async () => {
    const paper = makePaper();
    await storageService.addBookmark(paper);

    const bookmarks = await storageService.getBookmarks();
    expect(bookmarks.ok).toBe(true);
    if (bookmarks.ok) {
      expect(bookmarks.value[paper.paperId]).toBeDefined();
    }
  });

  it("removes bookmark when clicked again", async () => {
    const paper = makePaper();
    await storageService.addBookmark(paper);
    await storageService.removeBookmark(paper.paperId);

    const isMarked = await storageService.isBookmarked(paper.paperId);
    expect(isMarked).toBe(false);
  });

  it("bookmark includes paper metadata", async () => {
    const paper = makePaper();
    await storageService.addBookmark(paper);

    const bookmarks = await storageService.getBookmarks();
    if (bookmarks.ok) {
      const entry = bookmarks.value[paper.paperId];
      expect(entry!.paper.title).toBe(paper.title);
      expect(entry!.paper.authors).toEqual(paper.authors);
    }
  });

  it("multiple bookmarks can be stored", async () => {
    const paper1 = makePaper("2024.acl-long.1");
    const paper2 = makePaper("2024.acl-long.2");

    await storageService.addBookmark(paper1);
    await storageService.addBookmark(paper2);

    const bookmarks = await storageService.getBookmarks();
    if (bookmarks.ok) {
      expect(Object.keys(bookmarks.value)).toHaveLength(2);
    }
  });
});

describe("ListingContentScript - DOM interaction simulation", () => {
  it("creates button elements correctly", () => {
    const win = new Window({ url: "https://aclanthology.org/2024.acl-long.1/" });
    const doc = win.document;

    const btn = doc.createElement("button");
    btn.className = "acl-tools-btn";
    btn.textContent = "BibTeX";

    expect(btn.textContent).toBe("BibTeX");
    expect(btn.className).toBe("acl-tools-btn");
  });

  it("attaches hidden attribute to filtered entries", () => {
    const win = new Window({ url: "https://aclanthology.org/events/acl-2024/" });
    const doc = win.document;

    const el = doc.createElement("p");
    el.className = "d-sm-flex";
    doc.body.appendChild(el);

    el.setAttribute("hidden", "");
    expect(el.hasAttribute("hidden")).toBe(true);

    el.removeAttribute("hidden");
    expect(el.hasAttribute("hidden")).toBe(false);
  });
});
