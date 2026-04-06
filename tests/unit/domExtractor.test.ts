import { describe, it, expect, beforeEach } from "vitest";
import { Window } from "happy-dom";
import { extractListingEntries, extractDetailEntry } from "../../src/utils/domExtractor.js";

// Helper to create a document from HTML using happy-dom
function createDocument(html: string): Document {
  const win = new Window({ url: "https://aclanthology.org/" });
  win.document.body.innerHTML = html;
  return win.document as unknown as Document;
}

function createDetailDocument(html: string, url: string): Document {
  const win = new Window({ url });
  win.document.body.innerHTML = html;
  return win.document as unknown as Document;
}

// Sample ACL Anthology listing HTML snapshot (matches actual DOM structure)
// Paper entry is div.d-sm-flex; abstract is a sibling div.abstract-collapse
const LISTING_HTML = `
<div class="d-sm-flex align-items-stretch mb-3">
  <div class="d-block me-2 list-button-row">
    <a class="badge" href="https://aclanthology.org/2024.acl-long.1.pdf">pdf</a>
    <a class="badge" href="/2024.acl-long.1.bib">bib</a>
  </div>
  <span class="d-block">
    <strong><a class="align-middle" href="/2024.acl-long.1/">Attention Is All You Need</a></strong><br>
    <a href="/people/alice-smith/">Alice Smith</a>
    |
    <a href="/people/bob-jones/">Bob Jones</a>
  </span>
</div>
<div class="card collapse abstract-collapse" id="abstract-2024--acl-long--1">
  <div class="card-body">We propose the Transformer architecture.</div>
</div>
<div class="d-sm-flex align-items-stretch mb-3">
  <div class="d-block me-2 list-button-row">
    <a class="badge" href="/2024.acl-long.2.bib">bib</a>
  </div>
  <span class="d-block">
    <strong><a class="align-middle" href="/2024.acl-long.2/">BERT: Pre-training Deep Bidirectional Transformers</a></strong><br>
    <a href="/people/carol-white/">Carol White</a>
  </span>
</div>
`;

const DETAIL_HTML = `
<h2 class="title">Attention Is All You Need</h2>
<div class="lead">
  <span class="author"><a href="/people/alice-smith/">Alice Smith</a></span>
  <span class="author"><a href="/people/bob-jones/">Bob Jones</a></span>
</div>
<div class="acl-abstract">
  <p>We propose a new simple network architecture, the Transformer.</p>
</div>
<div id="citeBibtex">
  <pre>@inproceedings{smith2024attention,
  title={Attention Is All You Need},
  author={Alice Smith and Bob Jones}
}</pre>
</div>
<a href="https://aclanthology.org/2024.acl-long.1.pdf">PDF</a>
<a href="/2024.acl-long.1.bib">BibTeX</a>
`;

describe("extractListingEntries()", () => {
  it("extracts paper entries from listing HTML", () => {
    const doc = createDocument(LISTING_HTML);
    const entries = extractListingEntries(doc);
    expect(entries.length).toBe(2);
  });

  it("extracts correct paperId from URL", () => {
    const doc = createDocument(LISTING_HTML);
    const entries = extractListingEntries(doc);
    const first = entries[0];
    expect(first).toBeDefined();
    expect(first!.paper.paperId).toBe("2024.acl-long.1");
  });

  it("extracts correct title", () => {
    const doc = createDocument(LISTING_HTML);
    const entries = extractListingEntries(doc);
    const first = entries[0];
    expect(first!.paper.title).toBe("Attention Is All You Need");
  });

  it("extracts correct authors", () => {
    const doc = createDocument(LISTING_HTML);
    const entries = extractListingEntries(doc);
    const first = entries[0];
    expect(first!.paper.authors).toContain("Alice Smith");
    expect(first!.paper.authors).toContain("Bob Jones");
  });

  it("extracts BibTeX URL", () => {
    const doc = createDocument(LISTING_HTML);
    const entries = extractListingEntries(doc);
    const first = entries[0];
    expect(first!.paper.bibUrl).toContain("2024.acl-long.1.bib");
  });

  it("extracts PDF URL when present", () => {
    const doc = createDocument(LISTING_HTML);
    const entries = extractListingEntries(doc);
    const first = entries[0];
    expect(first!.paper.pdfUrl).toBeDefined();
    expect(first!.paper.pdfUrl).toContain(".pdf");
  });

  it("sets pdfUrl to undefined when not present", () => {
    const doc = createDocument(LISTING_HTML);
    const entries = extractListingEntries(doc);
    const second = entries[1];
    // Second entry has no PDF link
    expect(second!.paper.pdfUrl).toBeUndefined();
  });

  it("extracts abstract when present", () => {
    const doc = createDocument(LISTING_HTML);
    const entries = extractListingEntries(doc);
    const first = entries[0];
    expect(first!.paper.abstract).toBe("We propose the Transformer architecture.");
  });

  it("returns element binding for each entry", () => {
    const doc = createDocument(LISTING_HTML);
    const entries = extractListingEntries(doc);
    for (const entry of entries) {
      expect(entry.element).toBeDefined();
      expect(entry.element.tagName).toBe("DIV");
    }
  });

  it("returns empty array for page with no paper entries", () => {
    const doc = createDocument("<div><p>No papers here</p></div>");
    const entries = extractListingEntries(doc);
    expect(entries).toHaveLength(0);
  });
});

describe("extractDetailEntry()", () => {
  it("extracts paper from detail page", () => {
    const doc = createDetailDocument(
      DETAIL_HTML,
      "https://aclanthology.org/2024.acl-long.1/"
    );
    const paper = extractDetailEntry(doc);
    expect(paper).not.toBeNull();
  });

  it("extracts correct paperId", () => {
    const doc = createDetailDocument(
      DETAIL_HTML,
      "https://aclanthology.org/2024.acl-long.1/"
    );
    const paper = extractDetailEntry(doc);
    expect(paper!.paperId).toBe("2024.acl-long.1");
  });

  it("extracts correct title", () => {
    const doc = createDetailDocument(
      DETAIL_HTML,
      "https://aclanthology.org/2024.acl-long.1/"
    );
    const paper = extractDetailEntry(doc);
    expect(paper!.title).toBe("Attention Is All You Need");
  });

  it("extracts correct authors", () => {
    const doc = createDetailDocument(
      DETAIL_HTML,
      "https://aclanthology.org/2024.acl-long.1/"
    );
    const paper = extractDetailEntry(doc);
    expect(paper!.authors).toContain("Alice Smith");
    expect(paper!.authors).toContain("Bob Jones");
  });

  it("extracts abstract", () => {
    const doc = createDetailDocument(
      DETAIL_HTML,
      "https://aclanthology.org/2024.acl-long.1/"
    );
    const paper = extractDetailEntry(doc);
    expect(paper!.abstract).toBe(
      "We propose a new simple network architecture, the Transformer."
    );
  });

  it("extracts PDF URL", () => {
    const doc = createDetailDocument(
      DETAIL_HTML,
      "https://aclanthology.org/2024.acl-long.1/"
    );
    const paper = extractDetailEntry(doc);
    expect(paper!.pdfUrl).toContain(".pdf");
  });

  it("returns null for non-paper pages", () => {
    const doc = createDetailDocument(
      "<h1>Homepage</h1>",
      "https://aclanthology.org/"
    );
    const paper = extractDetailEntry(doc);
    expect(paper).toBeNull();
  });

  it("returns null when URL does not match paper ID pattern", () => {
    const doc = createDetailDocument(
      DETAIL_HTML,
      "https://aclanthology.org/events/acl-2024/"
    );
    const paper = extractDetailEntry(doc);
    expect(paper).toBeNull();
  });
});
