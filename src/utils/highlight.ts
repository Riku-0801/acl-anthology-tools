/**
 * Text highlighting utilities.
 * Uses TreeWalker to insert <mark> elements into text nodes only.
 * Highlights are cleared by unwrapping <mark> elements — never via innerHTML —
 * so that event listeners on sibling elements (e.g. buttons) are preserved.
 */

const MARK_CLASS = "acl-hl";

/**
 * Highlights all case-insensitive occurrences of `query` in the text nodes
 * of `element`. Clears any previous highlights first.
 */
export function highlightMatches(element: HTMLElement, query: string): void {
  clearHighlight(element);
  if (query.trim() === "") return;
  applyHighlightToTextNodes(element, query.toLowerCase(), query.length);
}

/**
 * Removes all highlight marks from `element`, merging adjacent text nodes.
 */
export function clearHighlight(element: HTMLElement): void {
  const marks = element.querySelectorAll<HTMLElement>(`mark.${MARK_CLASS}`);
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (parent === null) continue;
    parent.replaceChild(
      document.createTextNode(mark.textContent ?? ""),
      mark
    );
    parent.normalize();
  }
}

/**
 * Walks all text nodes under `root` and wraps matches with <mark> elements.
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
      mark.className = MARK_CLASS;
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
