import { describe, it, expect, vi, beforeEach } from "vitest";
import { Window } from "happy-dom";

// Mock chrome APIs
const chromeMock = {
  runtime: {
    sendMessage: vi.fn(),
    lastError: undefined as chrome.runtime.LastError | undefined,
  },
};

vi.stubGlobal("chrome", chromeMock);

// Mock navigator.clipboard
const clipboardMock = {
  writeText: vi.fn(),
};

vi.stubGlobal("navigator", {
  clipboard: clipboardMock,
});

// Import service after mocking
const { getFromDom, fetchFromUrl, copyToClipboard } =
  await import("../../src/services/bibtex.js");

const SAMPLE_BIBTEX = `@inproceedings{smith2024,
  title={Test Paper},
  author={Alice Smith}
}`;

// Helper: set up DOM with BibTeX pre element
function setupBibtexDom(): void {
  const win = new Window({ url: "https://aclanthology.org/2024.acl-long.1/" });
  const div = win.document.createElement("div");
  div.id = "citeBibtex";
  const pre = win.document.createElement("pre");
  pre.textContent = SAMPLE_BIBTEX;
  div.appendChild(pre);
  win.document.body.appendChild(div);

  vi.stubGlobal("document", win.document as unknown as Document);
}

function clearBibtexDom(): void {
  const win = new Window({ url: "https://aclanthology.org/2024.acl-long.1/" });
  vi.stubGlobal("document", win.document as unknown as Document);
}

describe("getFromDom()", () => {
  it("returns BibTeX text when element exists", () => {
    setupBibtexDom();
    const result = getFromDom();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(SAMPLE_BIBTEX);
    }
  });

  it("returns error when element does not exist", () => {
    clearBibtexDom();
    const result = getFromDom();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("not_found");
    }
  });
});

describe("fetchFromUrl()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = undefined;
  });

  it("returns BibTeX text on success", async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_msg: unknown, callback: (response: unknown) => void) => {
        callback({ ok: true, value: SAMPLE_BIBTEX });
      }
    );

    const result = await fetchFromUrl("https://aclanthology.org/test.bib");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(SAMPLE_BIBTEX);
    }
  });

  it("returns fetch_failed error when service worker returns error", async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_msg: unknown, callback: (response: unknown) => void) => {
        callback({ ok: false, error: "HTTP 404: Not Found" });
      }
    );

    const result = await fetchFromUrl("https://aclanthology.org/missing.bib");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("fetch_failed");
    }
  });

  it("returns fetch_failed when chrome.runtime has lastError", async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_msg: unknown, callback: (response: unknown) => void) => {
        chromeMock.runtime.lastError = { message: "Extension context invalidated." };
        callback(undefined);
      }
    );

    const result = await fetchFromUrl("https://aclanthology.org/test.bib");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("fetch_failed");
    }
  });

  it("returns fetch_failed when response is undefined", async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_msg: unknown, callback: (response: unknown) => void) => {
        callback(undefined);
      }
    );

    const result = await fetchFromUrl("https://aclanthology.org/test.bib");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("fetch_failed");
    }
  });
});

describe("copyToClipboard()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("navigator", { clipboard: clipboardMock });
  });

  it("copies text to clipboard successfully", async () => {
    clipboardMock.writeText.mockResolvedValue(undefined);
    const result = await copyToClipboard(SAMPLE_BIBTEX);
    expect(result.ok).toBe(true);
    expect(clipboardMock.writeText).toHaveBeenCalledWith(SAMPLE_BIBTEX);
  });

  it("returns clipboard_denied error when writeText fails", async () => {
    clipboardMock.writeText.mockRejectedValue(
      new Error("NotAllowedError: Clipboard access denied")
    );
    const result = await copyToClipboard(SAMPLE_BIBTEX);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("clipboard_denied");
    }
  });

  it("returns clipboard_denied when clipboard is not available", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    const result = await copyToClipboard(SAMPLE_BIBTEX);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("clipboard_denied");
    }
  });
});
