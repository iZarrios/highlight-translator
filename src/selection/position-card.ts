import type { SelectionRectangle } from '@/selection/read-selection';

export type CardPosition = {
  left: number;
  top: number;
  placement: 'above' | 'below';
};

const GAP = 10;
const MARGIN = 12;

export function isRectangleVisible(
  rectangle: SelectionRectangle,
  viewport: { width: number; height: number },
): boolean {
  return (
    rectangle.bottom > 0 &&
    rectangle.top < viewport.height &&
    rectangle.right > 0 &&
    rectangle.left < viewport.width
  );
}

export function positionCard(
  selection: SelectionRectangle,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): CardPosition {
  const centeredLeft = selection.left + (selection.width - card.width) / 2;
  const left = Math.min(
    Math.max(centeredLeft, MARGIN),
    Math.max(MARGIN, viewport.width - card.width - MARGIN),
  );
  const fitsBelow =
    selection.bottom + GAP + card.height <= viewport.height - MARGIN;
  const top = fitsBelow
    ? selection.bottom + GAP
    : Math.max(MARGIN, selection.top - card.height - GAP);
  return { left, top, placement: fitsBelow ? 'below' : 'above' };
}
