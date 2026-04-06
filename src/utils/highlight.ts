/**
 * Text highlighting utilities.
 * Uses TreeWalker to safely insert <mark> elements without innerHTML injection.
 * Original HTML is saved/restored via element.dataset to handle re-highlighting
 * when the query changes.
 */

const DATA_KEY = "aclOriginal";

/**
 * Highlights all case-insensitive occurrences of `query` in the text nodes
 * of `element`. Saves original innerHTML before first modification so it can
 * be restored by clearHighlight().
 */
export function highlightMatches(element: HTMLElement, query: string): void {
  // Restore original DOM before re-applying (handles query changes)
  const saved = element.dataset[DATA_KEY];
  if (saved !== undefined) {
    element.innerHTML = saved;
  } else {
    element.dataset[DATA_KEY] = element.innerHTML;
  }

  if (query.trim() === "") return;

  const lowerQuery = query.toLowerCase();
  applyHighlightToTextNodes(element, lowerQuery, query.length);
}

/**
 * Restores the element to its original HTML before any highlighting was applied.
 */
export function clearHighlight(element: HTMLElement): void {
  const saved = element.dataset[DATA_KEY];
  if (saved !== undefined) {
    element.innerHTML = saved;
    delete element.dataset[DATA_KEY];
  }
}

/**
 * Walks all text nodes under `root` and wraps matches with <mark> elements.
 * Uses DocumentFragment to batch DOM insertions.
 */
function applyHighlightToTextNodes(
  root: HTMLElement,
  lowerQuery: string,
  queryLength: number
): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null = walker.nextNode();
  while (node !== null) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? "";
    const lowerText = text.toLowerCase();

    let searchFrom = 0;
    let matchIndex = lowerText.indexOf(lowerQuery, searchFrom);
    if (matchIndex === -1) continue;

    const parent = textNode.parentNode;
    if (parent === null) continue;

    const fragment = document.createDocumentFragment();

    while (matchIndex !== -1) {
      if (matchIndex > searchFrom) {
        fragment.appendChild(
          document.createTextNode(text.slice(searchFrom, matchIndex))
        );
      }
      const mark = document.createElement("mark");
      mark.textContent = text.slice(matchIndex, matchIndex + queryLength);
      fragment.appendChild(mark);

      searchFrom = matchIndex + queryLength;
      matchIndex = lowerText.indexOf(lowerQuery, searchFrom);
    }

    if (searchFrom < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(searchFrom)));
    }

    parent.replaceChild(fragment, textNode);
  }
}
