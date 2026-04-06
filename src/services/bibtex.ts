import type { BibtexError, MessageRequest, MessageResponse, Result } from "../types/index.js";
import { extractBibtexFromDetailDom } from "../utils/domExtractor.js";

/**
 * Extracts BibTeX text from the detail page DOM.
 * Used on paper detail pages where BibTeX is embedded in <div id="citeBibtex"><pre>.
 */
export function getFromDom(): Result<string, BibtexError> {
  const text = extractBibtexFromDetailDom(document);
  if (text === null) {
    return {
      ok: false,
      error: {
        kind: "not_found",
        message: "BibTeX element not found in DOM (expected #citeBibtex pre)",
      },
    };
  }
  return { ok: true, value: text };
}

/**
 * Fetches BibTeX from a URL via the Service Worker.
 * Used on listing pages where BibTeX is not embedded.
 */
export async function fetchFromUrl(
  bibUrl: string
): Promise<Result<string, BibtexError>> {
  const message: MessageRequest = { action: "FETCH_BIBTEX", bibUrl };

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      message,
      (response: MessageResponse<string> | undefined) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error: {
              kind: "fetch_failed",
              message:
                chrome.runtime.lastError.message ?? "Service worker error",
            },
          });
          return;
        }

        if (response === undefined) {
          resolve({
            ok: false,
            error: { kind: "fetch_failed", message: "No response from service worker" },
          });
          return;
        }

        if (!response.ok) {
          resolve({
            ok: false,
            error: { kind: "fetch_failed", message: response.error },
          });
          return;
        }

        resolve({ ok: true, value: response.value });
      }
    );
  });
}

/**
 * Copies BibTeX text to the clipboard.
 */
export async function copyToClipboard(
  bibtex: string
): Promise<Result<void, BibtexError>> {
  if (!navigator.clipboard) {
    return {
      ok: false,
      error: {
        kind: "clipboard_denied",
        message: "Clipboard API not available",
      },
    };
  }

  try {
    await navigator.clipboard.writeText(bibtex);
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "clipboard_denied",
        message: err instanceof Error ? err.message : "Clipboard write failed",
      },
    };
  }
}
