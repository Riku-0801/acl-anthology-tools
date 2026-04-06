import { describe, it, expect, vi, beforeEach } from "vitest";
import { Window } from "happy-dom";

// We test the core logic of the events content script by importing and testing
// the underlying services it uses, and simulating the DOM manipulation.

import { buildSearchIndex, filterByIndex } from "../../src/services/search.js";
import type { PaperEntry, PaperElementBinding } from "../../src/types/index.js";

function makeWindow(html: string): Window {
  const win = new Window({ url: "https://aclanthology.org/events/acl-2024/" });
  win.document.body.innerHTML = html;
  return win;
}

function makePaper(id: string, title: string, authors: string[] = []): PaperEntry {
  return {
    paperId: id,
    title,
    authors,
    bibUrl: `https://aclanthology.org/${id}.bib`,
    pageUrl: `https://aclanthology.org/${id}/`,
  };
}

// Simulate the search bar injection logic
function injectSearchBar(
  doc: Document,
  bindings: PaperElementBinding[]
): { input: HTMLInputElement; counter: HTMLElement } | null {
  const firstEntry = bindings[0];
  if (firstEntry === undefined) return null;

  const parent = firstEntry.element.parentElement;
  if (parent === null) return null;

  const container = doc.createElement("div");
  container.id = "acl-tools-search-container";

  const input = doc.createElement("input") as HTMLInputElement;
  input.type = "text";
  input.id = "acl-tools-search-input";

  const counter = doc.createElement("span");
  counter.id = "acl-tools-search-counter";
  counter.textContent = `全${bindings.length}件`;

  container.appendChild(input);
  container.appendChild(counter);

  parent.insertBefore(container, firstEntry.element);

  const papers = bindings.map((b) => b.paper);
  const searchIndex = buildSearchIndex(papers);

  input.addEventListener("input", () => {
    const query = input.value;
    const matchingIndices = filterByIndex(searchIndex, query);
    let visibleCount = 0;

    for (let i = 0; i < bindings.length; i++) {
      const binding = bindings[i];
      if (binding === undefined) continue;

      if (matchingIndices.has(i)) {
        binding.element.removeAttribute("hidden");
        visibleCount++;
      } else {
        binding.element.setAttribute("hidden", "");
      }
    }

    if (query.trim() === "") {
      counter.textContent = `全${bindings.length}件`;
    } else {
      counter.textContent = `${visibleCount}件 / 全${bindings.length}件`;
    }
  });

  return { input, counter };
}

describe("EventsContentScript - search bar injection", () => {
  let win: Window;
  let doc: Document;
  let bindings: PaperElementBinding[];

  beforeEach(() => {
    win = makeWindow(`
      <div id="papers-container">
        <div class="d-sm-flex" id="entry-1">Paper 1</div>
        <div class="d-sm-flex" id="entry-2">Paper 2</div>
        <div class="d-sm-flex" id="entry-3">Paper 3</div>
      </div>
    `);
    doc = win.document as unknown as Document;

    const elements = doc.querySelectorAll<HTMLElement>("div.d-sm-flex");
    const elementArray = Array.from(elements);

    bindings = [
      { paper: makePaper("2024.acl-long.1", "Attention Is All You Need", ["Alice"]), element: elementArray[0]! },
      { paper: makePaper("2024.acl-long.2", "BERT Pre-training", ["Bob"]), element: elementArray[1]! },
      { paper: makePaper("2024.acl-long.3", "GPT Language Model", ["Carol"]), element: elementArray[2]! },
    ];
  });

  it("injects search bar into DOM", () => {
    injectSearchBar(doc, bindings);
    const container = doc.getElementById("acl-tools-search-container");
    expect(container).not.toBeNull();
  });

  it("injects search input element", () => {
    injectSearchBar(doc, bindings);
    const input = doc.getElementById("acl-tools-search-input");
    expect(input).not.toBeNull();
    expect(input!.tagName).toBe("INPUT");
  });

  it("shows total count in counter", () => {
    injectSearchBar(doc, bindings);
    const counter = doc.getElementById("acl-tools-search-counter");
    expect(counter).not.toBeNull();
    expect(counter!.textContent).toBe("全3件");
  });

  it("hides non-matching entries on input", () => {
    const result = injectSearchBar(doc, bindings);
    expect(result).not.toBeNull();
    const { input } = result!;

    // Simulate typing
    input.value = "attention";
    input.dispatchEvent(new Event("input"));

    expect(bindings[0]!.element.hasAttribute("hidden")).toBe(false);
    expect(bindings[1]!.element.hasAttribute("hidden")).toBe(true);
    expect(bindings[2]!.element.hasAttribute("hidden")).toBe(true);
  });

  it("updates counter to show match count", () => {
    const result = injectSearchBar(doc, bindings);
    expect(result).not.toBeNull();
    const { input, counter } = result!;

    input.value = "bert";
    input.dispatchEvent(new Event("input"));

    expect(counter.textContent).toBe("1件 / 全3件");
  });

  it("restores all entries when query is cleared", () => {
    const result = injectSearchBar(doc, bindings);
    expect(result).not.toBeNull();
    const { input, counter } = result!;

    // Filter first
    input.value = "attention";
    input.dispatchEvent(new Event("input"));

    // Clear
    input.value = "";
    input.dispatchEvent(new Event("input"));

    for (const binding of bindings) {
      expect(binding.element.hasAttribute("hidden")).toBe(false);
    }
    expect(counter.textContent).toBe("全3件");
  });

  it("shows 0 matches for query with no results", () => {
    const result = injectSearchBar(doc, bindings);
    expect(result).not.toBeNull();
    const { input, counter } = result!;

    input.value = "zzz-no-match";
    input.dispatchEvent(new Event("input"));

    expect(counter.textContent).toBe("0件 / 全3件");
    for (const binding of bindings) {
      expect(binding.element.hasAttribute("hidden")).toBe(true);
    }
  });

  it("does not inject search bar if no bindings", () => {
    const result = injectSearchBar(doc, []);
    expect(result).toBeNull();
  });

  it("inserts search bar before the first paper entry", () => {
    injectSearchBar(doc, bindings);
    const container = doc.getElementById("acl-tools-search-container");
    const firstEntry = bindings[0]!.element;
    const parent = firstEntry.parentElement!;
    const children = Array.from(parent.children);

    const containerIdx = children.indexOf(container!);
    const entryIdx = children.indexOf(firstEntry);

    expect(containerIdx).toBeLessThan(entryIdx);
  });
});
