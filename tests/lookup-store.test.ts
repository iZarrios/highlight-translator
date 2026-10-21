import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLookupStore } from '@/lookup-store';
import type { SelectionSnapshot } from '@/read-selection';

const selection = (): SelectionSnapshot => ({
  text: 'bonjour',
  nearbyContext: 'bonjour tout le monde',
  rectangle: {
    left: 10,
    right: 70,
    top: 20,
    bottom: 40,
    width: 60,
    height: 20,
  },
  anchor: {
    rectangle: () => ({
      left: 10,
      right: 70,
      top: 20,
      bottom: 40,
      width: 60,
      height: 20,
    }),
  },
});

describe('lookup store', () => {
  beforeEach(() => useLookupStore.getState().close());

  it('does not publish an equivalent selection again', () => {
    useLookupStore.getState().show(selection());
    const original = useLookupStore.getState().selection;
    const listener = vi.fn();
    const unsubscribe = useLookupStore.subscribe(listener);

    useLookupStore.getState().show(selection());

    expect(useLookupStore.getState().selection).toBe(original);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
