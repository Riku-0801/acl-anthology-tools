import type {
  AuthorCacheEntry,
  AuthorError,
  MessageRequest,
  MessageResponse,
  PaperEntry,
  Result,
} from "../types/index.js";
import { AUTHOR_CACHE_TTL_MS } from "../constants/selectors.js";

/**
 * Retrieves recent papers for an author.
 * Checks the author cache first (60-minute TTL), then fetches via Service Worker.
 */
export async function getRecentPapers(
  authorSlug: string,
  maxCount: number
): Promise<Result<PaperEntry[], AuthorError>> {
  // Check cache first
  const cachedResult = await getCachedAuthorPapers(authorSlug);
  if (cachedResult !== null) {
    return { ok: true, value: cachedResult.slice(0, maxCount) };
  }

  // Fetch via Service Worker
  const message: MessageRequest = {
    action: "FETCH_AUTHOR_PAPERS",
    authorSlug,
    maxCount,
  };

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      message,
      (response: MessageResponse<PaperEntry[]> | undefined) => {
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
            error: {
              kind: "fetch_failed",
              message: "No response from service worker",
            },
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

        // Cache the result
        void cacheAuthorPapers(authorSlug, response.value);

        resolve({ ok: true, value: response.value.slice(0, maxCount) });
      }
    );
  });
}

/**
 * Returns cached author papers if cache is valid (within TTL), otherwise null.
 */
async function getCachedAuthorPapers(
  authorSlug: string
): Promise<readonly PaperEntry[] | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get("authorCache", (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

      const cache = (result["authorCache"] ?? {}) as Record<
        string,
        AuthorCacheEntry
      >;
      const entry = cache[authorSlug];

      if (entry === undefined) {
        resolve(null);
        return;
      }

      const cachedAt = new Date(entry.cachedAt).getTime();
      const now = Date.now();

      if (now - cachedAt > AUTHOR_CACHE_TTL_MS) {
        resolve(null); // Cache expired
        return;
      }

      resolve(entry.recentPapers);
    });
  });
}

/**
 * Saves author papers to the cache.
 */
async function cacheAuthorPapers(
  authorSlug: string,
  papers: readonly PaperEntry[]
): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get("authorCache", (result) => {
      if (chrome.runtime.lastError) {
        resolve();
        return;
      }

      const cache = (result["authorCache"] ?? {}) as Record<
        string,
        AuthorCacheEntry
      >;

      const entry: AuthorCacheEntry = {
        authorSlug,
        recentPapers: papers,
        cachedAt: new Date().toISOString(),
      };

      chrome.storage.local.set({ authorCache: { ...cache, [authorSlug]: entry } }, () => {
        resolve();
      });
    });
  });
}
