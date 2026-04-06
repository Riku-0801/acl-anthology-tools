import type { PaperEntry } from "../types/index.js";

/**
 * Pre-lowercased concatenated search text for each paper.
 * Build once at page load with buildSearchIndex(), then reuse on every keystroke.
 */
export type SearchIndex = readonly string[];

/**
 * Builds a SearchIndex from a PaperEntry array.
 * All text is lowercased and concatenated at build time to avoid
 * repeated toLowerCase() calls during filtering.
 */
export function buildSearchIndex(papers: PaperEntry[]): SearchIndex {
  return papers.map((p) => {
    const parts: string[] = [p.title, ...p.authors];
    if (p.abstract !== undefined) {
      parts.push(p.abstract);
    }
    return parts.join(" ").toLowerCase();
  });
}

/**
 * Filters using a pre-built SearchIndex instead of PaperEntry[].
 * O(n) with no toLowerCase() allocations per call.
 * Empty query returns all indices.
 */
export function filterByIndex(index: SearchIndex, query: string): Set<number> {
  const indices = new Set<number>();

  if (query.trim() === "") {
    for (let i = 0; i < index.length; i++) {
      indices.add(i);
    }
    return indices;
  }

  const lowerQuery = query.toLowerCase();
  for (let i = 0; i < index.length; i++) {
    const entry = index[i];
    if (entry !== undefined && entry.includes(lowerQuery)) {
      indices.add(i);
    }
  }

  return indices;
}

/**
 * Filters papers by a query string.
 * Case-insensitive partial match on title, authors, and abstract.
 * If abstract is undefined, only title and authors are searched.
 * Returns a Set of matching indices.
 * Empty query returns all indices.
 */
export function filter(papers: PaperEntry[], query: string): Set<number> {
  const indices = new Set<number>();

  if (query.trim() === "") {
    // Return all indices
    for (let i = 0; i < papers.length; i++) {
      indices.add(i);
    }
    return indices;
  }

  const lowerQuery = query.toLowerCase();

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    if (paper === undefined) continue;

    if (matchesPaper(paper, lowerQuery)) {
      indices.add(i);
    }
  }

  return indices;
}

/**
 * Checks if a paper matches the query.
 */
function matchesPaper(paper: PaperEntry, lowerQuery: string): boolean {
  // Check title
  if (paper.title.toLowerCase().includes(lowerQuery)) {
    return true;
  }

  // Check authors
  for (const author of paper.authors) {
    if (author.toLowerCase().includes(lowerQuery)) {
      return true;
    }
  }

  // Check abstract (only if defined)
  if (paper.abstract !== undefined) {
    if (paper.abstract.toLowerCase().includes(lowerQuery)) {
      return true;
    }
  }

  return false;
}
