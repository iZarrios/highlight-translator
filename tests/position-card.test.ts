import { describe, expect, it } from 'vitest';
import { positionCard } from '@/selection/position-card';

describe('positionCard', () => {
  it('centers below a selection when there is room', () => {
    expect(
      positionCard(
        {
          left: 300,
          right: 400,
          top: 100,
          bottom: 120,
          width: 100,
          height: 20,
        },
        { width: 200, height: 160 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ left: 250, top: 130, placement: 'below' });
  });

  it('moves above the selection and stays inside narrow viewports', () => {
    expect(
      positionCard(
        { left: 4, right: 54, top: 500, bottom: 520, width: 50, height: 20 },
        { width: 300, height: 180 },
        { width: 320, height: 600 },
      ),
    ).toEqual({ left: 12, top: 310, placement: 'above' });
  });
});
