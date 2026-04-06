import { describe, it, expect } from "vitest";
import { filter, buildSearchIndex, filterByIndex } from "../../src/services/search.js";
import type { PaperEntry } from "../../src/types/index.js";

const makePaper = (overrides: Partial<PaperEntry> = {}): PaperEntry => ({
  paperId: "2024.acl-long.1",
  title: "Attention Is All You Need",
  authors: ["Alice Smith", "Bob Jones"],
  abstract: "We propose a new simple network architecture, the Transformer.",
  bibUrl: "https://aclanthology.org/2024.acl-long.1.bib",
  pageUrl: "https://aclanthology.org/2024.acl-long.1/",
  ...overrides,
});

describe("filter()", () => {
  it("returns all indices for empty query", () => {
    const papers = [makePaper(), makePaper({ paperId: "2024.acl-long.2" })];
    const result = filter(papers, "");
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(true);
  });

  it("returns all indices for whitespace-only query", () => {
    const papers = [makePaper(), makePaper({ paperId: "2024.acl-long.2" })];
    const result = filter(papers, "   ");
    expect(result.size).toBe(2);
  });

  it("returns empty set when no papers match", () => {
    const papers = [makePaper()];
    const result = filter(papers, "zzz-no-match-xyz");
    expect(result.size).toBe(0);
  });

  it("matches by title (case-insensitive partial match)", () => {
    const papers = [
      makePaper({ title: "Attention Is All You Need" }),
      makePaper({ paperId: "2024.acl-long.2", title: "BERT: Pre-training" }),
    ];
    const result = filter(papers, "attention");
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(false);
  });

  it("matches by title with uppercase query", () => {
    const papers = [makePaper({ title: "attention is all you need" })];
    const result = filter(papers, "ATTENTION");
    expect(result.has(0)).toBe(true);
  });

  it("matches by author name (case-insensitive)", () => {
    const papers = [
      makePaper({ authors: ["Alice Smith", "Bob Jones"] }),
      makePaper({ paperId: "2024.acl-long.2", authors: ["Carol White"] }),
    ];
    const result = filter(papers, "alice");
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(false);
  });

  it("matches by author last name", () => {
    const papers = [makePaper({ authors: ["Alice Smith"] })];
    const result = filter(papers, "smith");
    expect(result.has(0)).toBe(true);
  });

  it("matches by abstract", () => {
    const papers = [
      makePaper({ abstract: "We propose a Transformer architecture." }),
      makePaper({ paperId: "2024.acl-long.2", abstract: "We use LSTM networks." }),
    ];
    const result = filter(papers, "transformer");
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(false);
  });

  it("matches by abstract case-insensitively", () => {
    const papers = [makePaper({ abstract: "The Transformer model is great." })];
    const result = filter(papers, "TRANSFORMER");
    expect(result.has(0)).toBe(true);
  });

  it("falls back to title+author when abstract is undefined", () => {
    const papers = [
      makePaper({ abstract: undefined, title: "Neural Networks" }),
    ];
    const resultTitle = filter(papers, "neural");
    expect(resultTitle.has(0)).toBe(true);

    const resultAbstract = filter(papers, "some abstract text");
    expect(resultAbstract.has(0)).toBe(false);
  });

  it("handles papers without abstract gracefully", () => {
    const papers = [
      makePaper({ abstract: undefined }),
      makePaper({ paperId: "2024.acl-long.2", abstract: "Has abstract." }),
    ];
    const result = filter(papers, "abstract");
    expect(result.has(0)).toBe(false);
    expect(result.has(1)).toBe(true);
  });

  it("handles empty paper array", () => {
    const result = filter([], "some query");
    expect(result.size).toBe(0);
  });

  it("returns correct indices when multiple papers match", () => {
    const papers = [
      makePaper({ title: "Deep Learning for NLP" }),
      makePaper({ paperId: "2", title: "NLP with Transformers" }),
      makePaper({ paperId: "3", title: "Computer Vision" }),
    ];
    const result = filter(papers, "nlp");
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(false);
  });
});

describe("buildSearchIndex()", () => {
  it("returns array of same length as papers", () => {
    const papers = [makePaper(), makePaper({ paperId: "2" })];
    expect(buildSearchIndex(papers)).toHaveLength(2);
  });

  it("lowercases all text", () => {
    const papers = [makePaper({ title: "UPPER CASE Title" })];
    const index = buildSearchIndex(papers);
    expect(index[0]).toContain("upper case title");
  });

  it("includes authors in the index", () => {
    const papers = [makePaper({ authors: ["Alice Smith"] })];
    const index = buildSearchIndex(papers);
    expect(index[0]).toContain("alice smith");
  });

  it("includes abstract when defined", () => {
    const papers = [makePaper({ abstract: "Transformer architecture" })];
    const index = buildSearchIndex(papers);
    expect(index[0]).toContain("transformer architecture");
  });

  it("omits abstract when undefined (does not include 'undefined' string)", () => {
    const papers = [makePaper({ abstract: undefined, title: "Only Title" })];
    const index = buildSearchIndex(papers);
    expect(index[0]).not.toContain("undefined");
  });

  it("returns empty array for empty input", () => {
    expect(buildSearchIndex([])).toHaveLength(0);
  });
});

describe("filterByIndex()", () => {
  it("returns all indices for empty query", () => {
    const papers = [makePaper(), makePaper({ paperId: "2" })];
    const index = buildSearchIndex(papers);
    const result = filterByIndex(index, "");
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(true);
  });

  it("returns all indices for whitespace-only query", () => {
    const papers = [makePaper(), makePaper({ paperId: "2" })];
    const index = buildSearchIndex(papers);
    expect(filterByIndex(index, "   ").size).toBe(2);
  });

  it("matches case-insensitively", () => {
    const papers = [makePaper({ title: "Attention Is All You Need" })];
    const index = buildSearchIndex(papers);
    expect(filterByIndex(index, "ATTENTION").has(0)).toBe(true);
  });

  it("returns empty set for no match", () => {
    const papers = [makePaper()];
    const index = buildSearchIndex(papers);
    expect(filterByIndex(index, "zzz-no-match").size).toBe(0);
  });

  it("matches by author", () => {
    const papers = [makePaper({ authors: ["Alice Smith"] })];
    const index = buildSearchIndex(papers);
    expect(filterByIndex(index, "alice").has(0)).toBe(true);
  });

  it("returns correct indices when multiple papers match", () => {
    const papers = [
      makePaper({ title: "Deep Learning for NLP" }),
      makePaper({ paperId: "2", title: "NLP with Transformers" }),
      makePaper({ paperId: "3", title: "Computer Vision" }),
    ];
    const index = buildSearchIndex(papers);
    const result = filterByIndex(index, "nlp");
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(false);
  });

  it("handles empty index", () => {
    expect(filterByIndex([], "query").size).toBe(0);
  });
});
