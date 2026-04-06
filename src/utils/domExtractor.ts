import type { PaperEntry, PaperElementBinding } from "../types/index.js";
import {
  PAPER_ENTRY_SELECTOR,
  PAPER_TITLE_SELECTOR,
  PAPER_TITLE_ALT_SELECTOR,
  AUTHOR_LINK_SELECTOR,
  BIBTEX_LINK_SELECTOR,
  PDF_LINK_SELECTOR,
  ABSTRACT_SIBLING_CLASS,
  DETAIL_BIBTEX_SELECTOR,
  DETAIL_TITLE_SELECTOR,
  DETAIL_AUTHOR_SELECTOR,
  DETAIL_ABSTRACT_SELECTOR,
  DETAIL_PDF_SELECTOR,
  DETAIL_BIB_SELECTOR,
  PAPER_ID_URL_PATTERN,
} from "../constants/selectors.js";

/**
 * Extracts a paper ID from a URL string.
 * Returns null if no valid paper ID is found.
 */
function extractPaperIdFromUrl(url: string): string | null {
  const match = PAPER_ID_URL_PATTERN.exec(url);
  return match?.[1] ?? null;
}

/**
 * Gets the base URL (origin) for building absolute URLs.
 */
function getBaseUrl(root: Document): string {
  return root.location?.origin ?? "https://aclanthology.org";
}

/**
 * Builds an absolute URL from a potentially relative href.
 */
function toAbsoluteUrl(href: string, baseUrl: string): string {
  if (href === "") return "";
  return href.startsWith("http") ? href : `${baseUrl}${href}`;
}

/**
 * Extracts paper entries from a listing page.
 * Returns an array of PaperElementBinding objects.
 */
export function extractListingEntries(
  root: Document
): PaperElementBinding[] {
  const baseUrl = getBaseUrl(root);
  const entries: PaperElementBinding[] = [];

  const paperElements = root.querySelectorAll<HTMLElement>(PAPER_ENTRY_SELECTOR);

  for (const element of paperElements) {
    const binding = extractPaperFromElement(element, baseUrl);
    if (binding !== null) {
      entries.push(binding);
    }
  }

  return entries;
}

/**
 * Finds the abstract text element for a paper entry.
 * On ACL Anthology, the abstract is a sibling div (div.abstract-collapse),
 * not a child of the paper entry element.
 */
function extractAbstractSibling(element: HTMLElement): HTMLElement | null {
  const sibling = element.nextElementSibling;
  if (
    sibling instanceof HTMLElement &&
    sibling.classList.contains(ABSTRACT_SIBLING_CLASS)
  ) {
    return sibling.querySelector<HTMLElement>(".card-body");
  }
  return null;
}

/**
 * Extracts a single paper entry from a listing page element.
 */
function extractPaperFromElement(
  element: HTMLElement,
  baseUrl: string
): PaperElementBinding | null {
  const titleEl =
    element.querySelector<HTMLAnchorElement>(PAPER_TITLE_SELECTOR) ??
    element.querySelector<HTMLAnchorElement>(PAPER_TITLE_ALT_SELECTOR);

  if (titleEl === null) {
    return null;
  }

  const title = titleEl.textContent?.trim() ?? "";
  if (title === "") {
    return null;
  }

  const rawHref = titleEl.getAttribute("href") ?? "";
  const pageUrl = toAbsoluteUrl(rawHref, baseUrl);

  const paperId = extractPaperIdFromUrl(pageUrl);
  if (paperId === null) {
    return null;
  }

  const authorElements = element.querySelectorAll<HTMLElement>(AUTHOR_LINK_SELECTOR);
  const authors: string[] = [];
  for (const authorEl of authorElements) {
    const name = authorEl.textContent?.trim() ?? "";
    if (name !== "") {
      authors.push(name);
    }
  }

  const bibLinkEl = element.querySelector<HTMLAnchorElement>(BIBTEX_LINK_SELECTOR);
  const bibHref = bibLinkEl?.getAttribute("href") ?? "";
  const bibUrl =
    bibHref !== ""
      ? toAbsoluteUrl(bibHref, baseUrl)
      : `${baseUrl}/${paperId}.bib`;

  const pdfLinkEl = element.querySelector<HTMLAnchorElement>(PDF_LINK_SELECTOR);
  const pdfHref = pdfLinkEl?.getAttribute("href") ?? "";

  // Abstract is a sibling element (div.abstract-collapse), not a child of the paper entry.
  // It immediately follows the paper entry div in the DOM.
  const abstractEl = extractAbstractSibling(element);
  const abstractText = abstractEl?.textContent?.trim() ?? "";

  // Build paper entry - use conditional property assignment to satisfy exactOptionalPropertyTypes
  const paper = buildPaperEntry(
    paperId,
    title,
    authors,
    bibUrl,
    pageUrl,
    abstractText !== "" ? abstractText : undefined,
    pdfHref !== "" ? toAbsoluteUrl(pdfHref, baseUrl) : undefined
  );

  return { paper, element };
}

/**
 * Extracts a single paper entry from a detail page.
 * Returns null if the page is not a valid paper detail page.
 */
export function extractDetailEntry(root: Document): PaperEntry | null {
  const baseUrl = getBaseUrl(root);
  const pageUrl = root.location?.href ?? "";

  const paperId = extractPaperIdFromUrl(pageUrl);
  if (paperId === null) {
    return null;
  }

  const titleEl = root.querySelector<HTMLElement>(DETAIL_TITLE_SELECTOR);
  const title = titleEl?.textContent?.trim() ?? "";
  if (title === "") {
    return null;
  }

  const authorElements = root.querySelectorAll<HTMLElement>(DETAIL_AUTHOR_SELECTOR);
  const authors: string[] = [];
  for (const authorEl of authorElements) {
    const name = authorEl.textContent?.trim() ?? "";
    if (name !== "") {
      authors.push(name);
    }
  }

  const abstractEl = root.querySelector<HTMLElement>(DETAIL_ABSTRACT_SELECTOR);
  const abstractText = abstractEl?.textContent?.trim() ?? "";

  const pdfLinkEl = root.querySelector<HTMLAnchorElement>(DETAIL_PDF_SELECTOR);
  const pdfHref = pdfLinkEl?.getAttribute("href") ?? "";

  const bibLinkEl = root.querySelector<HTMLAnchorElement>(DETAIL_BIB_SELECTOR);
  const bibHref = bibLinkEl?.getAttribute("href") ?? "";
  const bibUrl =
    bibHref !== ""
      ? toAbsoluteUrl(bibHref, baseUrl)
      : `${baseUrl}/${paperId}.bib`;

  return buildPaperEntry(
    paperId,
    title,
    authors,
    bibUrl,
    pageUrl,
    abstractText !== "" ? abstractText : undefined,
    pdfHref !== "" ? toAbsoluteUrl(pdfHref, baseUrl) : undefined
  );
}

/**
 * Builds a PaperEntry object, setting optional properties only when defined.
 * This approach satisfies exactOptionalPropertyTypes.
 */
function buildPaperEntry(
  paperId: string,
  title: string,
  authors: string[],
  bibUrl: string,
  pageUrl: string,
  abstract: string | undefined,
  pdfUrl: string | undefined
): PaperEntry {
  // Start with required fields only
  const entry: { -readonly [K in keyof PaperEntry]?: PaperEntry[K] } = {
    paperId,
    title,
    authors,
    bibUrl,
    pageUrl,
  };

  if (abstract !== undefined) {
    entry.abstract = abstract;
  }
  if (pdfUrl !== undefined) {
    entry.pdfUrl = pdfUrl;
  }

  return entry as PaperEntry;
}

/**
 * Extracts the BibTeX text from a detail page DOM.
 * Returns null if the element is not found.
 */
export function extractBibtexFromDetailDom(root: Document): string | null {
  const bibtexEl = root.querySelector<HTMLElement>(DETAIL_BIBTEX_SELECTOR);
  const text = bibtexEl?.textContent?.trim() ?? null;
  return text !== "" ? text : null;
}
