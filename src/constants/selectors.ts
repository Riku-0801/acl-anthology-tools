// ACL Anthology DOM selectors
// All selectors are centralized here to minimize change scope

// Paper entry containers in listing pages
// Actual DOM: <div class="d-sm-flex align-items-stretch mb-3">
export const PAPER_ENTRY_SELECTOR = "div.d-sm-flex";

// Paper title within listing entries
// Actual DOM: <strong><a class="align-middle" href="/2024.acl-long.1/">Title</a></strong>
// Note: badge links (pdf/bib/abs) also have align-middle class, so scope to strong > a
export const PAPER_TITLE_SELECTOR = "strong > a.align-middle";
export const PAPER_TITLE_ALT_SELECTOR = "span.d-block strong a";

// Author links in listing
// Actual DOM: plain <a href="/people/{slug}/"> with no class
export const AUTHOR_LINK_SELECTOR = "a[href*='/people/']";

// Abstract sibling container class (abstract is a sibling div, NOT a child of the paper entry)
// Actual DOM: <div class="collapse abstract-collapse" id="abstract-...">
export const ABSTRACT_SIBLING_CLASS = "abstract-collapse";

// BibTeX link
export const BIBTEX_LINK_SELECTOR = "a[href$='.bib']";

// PDF link
export const PDF_LINK_SELECTOR = "a[href$='.pdf']";

// Abstract in listing pages (collapsed by default)
export const ABSTRACT_SELECTOR = ".collapse .card-body";
export const ABSTRACT_ALT_SELECTOR = ".abstract-collapse .card-body";

// Detail page selectors
// Actual DOM: <div class="tab-pane" id="citeBibtex"><pre id="citeBibtexContent">
export const DETAIL_BIBTEX_SELECTOR = "#citeBibtexContent, div#citeBibtex pre";
// Actual DOM: <h2 id="title">
export const DETAIL_TITLE_SELECTOR = "h2#title, h2.title";
// Actual DOM: <p class="lead"><a href="/people/...">Author</a>, ...
export const DETAIL_AUTHOR_SELECTOR = ".lead a[href*='/people/']";
// Actual DOM: <div class="card-body acl-abstract"><span>text</span>
export const DETAIL_ABSTRACT_SELECTOR = ".acl-abstract span, .acl-abstract p";
export const DETAIL_PDF_SELECTOR = "a[href$='.pdf']";
export const DETAIL_BIB_SELECTOR = "a[href$='.bib']";

// ACL Anthology paper ID pattern
// e.g. /2024.acl-long.1/ or /P19-1001/
export const PAPER_ID_URL_PATTERN =
  /\/(\d{4}\.[a-z0-9-]+\.\d+|[A-Z]\d{2}-\d{4})\/?$/;

// Author page pattern: /people/{slug}/
export const AUTHOR_SLUG_PATTERN = /\/people\/([^/]+)\/?$/;

// Storage capacity warning threshold (9 MB)
export const STORAGE_WARNING_BYTES = 9 * 1024 * 1024;

// Author cache TTL in milliseconds (60 minutes)
export const AUTHOR_CACHE_TTL_MS = 60 * 60 * 1000;
