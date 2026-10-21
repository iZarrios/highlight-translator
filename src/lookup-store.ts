import { create } from 'zustand';
import type { SelectionSnapshot } from '@/read-selection';

type LookupStore = {
  selection: SelectionSnapshot | undefined;
  show(selection: SelectionSnapshot): void;
  close(): void;
};

function sameSelection(
  current: SelectionSnapshot | undefined,
  next: SelectionSnapshot,
): boolean {
  if (!current) return false;
  const currentRectangle = current.rectangle;
  const nextRectangle = next.rectangle;
  return (
    current.text === next.text &&
    current.nearbyContext === next.nearbyContext &&
    currentRectangle.left === nextRectangle.left &&
    currentRectangle.right === nextRectangle.right &&
    currentRectangle.top === nextRectangle.top &&
    currentRectangle.bottom === nextRectangle.bottom &&
    currentRectangle.width === nextRectangle.width &&
    currentRectangle.height === nextRectangle.height
  );
}

export const useLookupStore = create<LookupStore>((set) => ({
  selection: undefined,
  show: (selection) =>
    set((current) =>
      sameSelection(current.selection, selection) ? current : { selection },
    ),
  close: () => set({ selection: undefined }),
}));
