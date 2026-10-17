const MAX_SELECTION_LENGTH = 4_000;
const MAX_CONTEXT_LENGTH = 1_500;

export type SelectionRectangle = Pick<
  DOMRect,
  'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'
>;

export type SelectionAnchor = {
  rectangle(): SelectionRectangle | undefined;
};

export type SelectionSnapshot = {
  text: string;
  nearbyContext?: string;
  rectangle: SelectionRectangle;
  anchor: SelectionAnchor;
};

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function selectedText(text: string): string {
  return text.trim().slice(0, MAX_SELECTION_LENGTH);
}

function contextAround(
  containerText: string,
  selectedText: string,
): string | undefined {
  const normalized = compact(containerText);
  const normalizedSelection = compact(selectedText);
  if (!normalized || normalized === normalizedSelection) return undefined;
  if (normalized.length <= MAX_CONTEXT_LENGTH) return normalized;

  const index = normalized
    .toLocaleLowerCase()
    .indexOf(normalizedSelection.toLocaleLowerCase());
  const center =
    index >= 0 ? index + normalizedSelection.length / 2 : normalized.length / 2;
  const start = Math.max(0, Math.floor(center - MAX_CONTEXT_LENGTH / 2));
  return normalized.slice(start, start + MAX_CONTEXT_LENGTH).trim();
}

function rangeContainer(range: Range): Element | null {
  const node = range.commonAncestorContainer;
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return (
    element?.closest(
      'p, li, blockquote, article, section, td, th, dd, dt, figcaption',
    ) ?? element
  );
}

function usableRectangle(
  rectangle: SelectionRectangle,
): SelectionRectangle | undefined {
  return rectangle.width > 0 || rectangle.height > 0 ? rectangle : undefined;
}

function inputSelection(): SelectionSnapshot | undefined {
  const element = document.activeElement;
  if (
    !(
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    )
  )
    return undefined;
  const start = element.selectionStart;
  const end = element.selectionEnd;
  if (start === null || end === null || start === end) return undefined;
  const text = selectedText(element.value.slice(start, end));
  if (!text) return undefined;
  const nearbyContext = contextAround(element.value, text);
  return {
    text,
    ...(nearbyContext ? { nearbyContext } : {}),
    rectangle: element.getBoundingClientRect(),
    anchor: {
      rectangle: () =>
        element.isConnected
          ? usableRectangle(element.getBoundingClientRect())
          : undefined,
    },
  };
}

export function readSelection(): SelectionSnapshot | undefined {
  const input = inputSelection();
  if (input) return input;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0)
    return undefined;
  const text = selectedText(selection.toString());
  if (!text) return undefined;

  const range = selection.getRangeAt(0);
  const rectangle = range.getBoundingClientRect();
  if (rectangle.width === 0 && rectangle.height === 0) return undefined;
  const container = rangeContainer(range);
  const nearbyContext = container?.textContent
    ? contextAround(container.textContent, text)
    : undefined;

  const anchorRange = range.cloneRange();
  return {
    text,
    ...(nearbyContext ? { nearbyContext } : {}),
    rectangle,
    anchor: {
      rectangle: () =>
        anchorRange.startContainer.isConnected
          ? usableRectangle(anchorRange.getBoundingClientRect())
          : undefined,
    },
  };
}
