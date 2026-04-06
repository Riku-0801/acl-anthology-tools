import type {
  MessageRequest,
  MessageResponse,
  PaperEntry,
} from "../types/index.js";
import { PAPER_ID_URL_PATTERN, AUTHOR_SLUG_PATTERN } from "../constants/selectors.js";

/**
 * Parses author papers from an ACL Anthology author page HTML.
 */
function parseAuthorPapers(
  html: string,
  authorSlug: string,
  maxCount: number
): PaperEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const papers: PaperEntry[] = [];

  // Author pages list papers in <div class="d-sm-flex ..."> elements
  const entryEls = doc.querySelectorAll<HTMLElement>("div.d-sm-flex");

  for (const el of entryEls) {
    if (papers.length >= maxCount) break;

    const titleEl = el.querySelector<HTMLAnchorElement>(
      "strong > a.align-middle"
    );
    if (titleEl === null) continue;

    const title = titleEl.textContent?.trim() ?? "";
    if (title === "") continue;

    const rawHref = titleEl.getAttribute("href") ?? "";
    const pageUrl = rawHref.startsWith("http")
      ? rawHref
      : `https://aclanthology.org${rawHref}`;

    const match = PAPER_ID_URL_PATTERN.exec(pageUrl);
    const paperId = match?.[1];
    if (paperId === undefined) continue;

    // Authors: plain <a href="/people/..."> with no class
    const authorEls = el.querySelectorAll<HTMLElement>("a[href*='/people/']");
    const authors: string[] = [];
    for (const ae of authorEls) {
      const name = ae.textContent?.trim() ?? "";
      if (name !== "") authors.push(name);
    }

    // PDF link
    const pdfEl = el.querySelector<HTMLAnchorElement>("a[href$='.pdf']");
    const pdfHref = pdfEl?.getAttribute("href") ?? "";
    const pdfUrl =
      pdfHref !== ""
        ? pdfHref.startsWith("http")
          ? pdfHref
          : `https://aclanthology.org${pdfHref}`
        : undefined;

    // BibTeX link
    const bibEl = el.querySelector<HTMLAnchorElement>("a[href$='.bib']");
    const bibHref = bibEl?.getAttribute("href") ?? "";
    const bibUrl =
      bibHref !== ""
        ? bibHref.startsWith("http")
          ? bibHref
          : `https://aclanthology.org${bibHref}`
        : `https://aclanthology.org/${paperId}.bib`;

    const entry: { -readonly [K in keyof PaperEntry]?: PaperEntry[K] } = {
      paperId,
      title,
      authors,
      bibUrl,
      pageUrl,
    };
    if (pdfUrl !== undefined) {
      entry.pdfUrl = pdfUrl;
    }
    papers.push(entry as PaperEntry);
  }

  return papers;
}

/**
 * Handles FETCH_BIBTEX messages.
 */
async function handleFetchBibtex(
  bibUrl: string
): Promise<MessageResponse<string>> {
  try {
    const response = await fetch(bibUrl, {
      method: "GET",
      headers: { Accept: "text/plain, application/x-bibtex, */*" },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const text = await response.text();
    return { ok: true, value: text };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}

/**
 * Handles FETCH_AUTHOR_PAPERS messages.
 */
async function handleFetchAuthorPapers(
  authorSlug: string,
  maxCount: number
): Promise<MessageResponse<PaperEntry[]>> {
  const url = `https://aclanthology.org/people/${authorSlug}/`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/html" },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    const papers = parseAuthorPapers(html, authorSlug, maxCount);
    return { ok: true, value: papers };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}

// Register message listener
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<unknown>) => void
  ): boolean => {
    const request = message as MessageRequest;

    if (request.action === "FETCH_BIBTEX") {
      void handleFetchBibtex(request.bibUrl).then(sendResponse);
      return true; // Keep message channel open for async response
    }

    if (request.action === "FETCH_AUTHOR_PAPERS") {
      void handleFetchAuthorPapers(request.authorSlug, request.maxCount).then(
        sendResponse
      );
      return true;
    }

    return false;
  }
);
