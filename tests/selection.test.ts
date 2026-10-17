import { describe, expect, it } from 'vitest';
import { readSelection } from '@/selection/read-selection';

describe('readSelection', () => {
  it('returns selected text, nearby context, and the range rectangle', () => {
    document.body.innerHTML =
      '<p>The quick brown fox jumps over the lazy dog.</p>';
    const textNode = document.querySelector('p')?.firstChild;
    if (!textNode) throw new Error('fixture failed');
    const range = document.createRange();
    range.setStart(textNode, 4);
    range.setEnd(textNode, 19);
    let rectangle = {
      left: 10,
      right: 80,
      top: 20,
      bottom: 35,
      width: 70,
      height: 15,
    };
    Object.defineProperty(range, 'getBoundingClientRect', {
      value: () => rectangle,
    });
    Object.defineProperty(range, 'cloneRange', { value: () => range });
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const snapshot = readSelection() as
      | (ReturnType<typeof readSelection> & {
          anchor: { rectangle(): { top: number; bottom: number } | undefined };
        })
      | undefined;
    expect(snapshot).toMatchObject({
      text: 'quick brown fox',
      nearbyContext: 'The quick brown fox jumps over the lazy dog.',
      rectangle: { left: 10, right: 80, top: 20, bottom: 35 },
    });

    rectangle = { ...rectangle, top: -30, bottom: -15 };
    expect(snapshot?.anchor.rectangle()).toMatchObject({
      top: -30,
      bottom: -15,
    });
  });

  it('ignores collapsed selections', () => {
    document.body.innerHTML = '<p>Nothing selected</p>';
    const node = document.querySelector('p')?.firstChild;
    if (!node) throw new Error('fixture failed');
    const range = document.createRange();
    range.setStart(node, 2);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(readSelection()).toBeUndefined();
  });
});
