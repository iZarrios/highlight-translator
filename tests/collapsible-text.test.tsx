import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollapsibleText } from '@/ui/components/collapsible-text';

describe('CollapsibleText', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('offers to expand visually overflowing text without truncating it', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(96);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(180);
    const explanation = 'A complete explanation that continues streaming.';

    render(<CollapsibleText value={explanation} />);

    expect(screen.getByText(explanation)).toHaveClass('line-clamp-6');
    const showMore = screen.getByRole('button', { name: 'Show more' });
    expect(showMore).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(showMore);

    expect(screen.getByText(explanation)).not.toHaveClass('line-clamp-6');
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('does not render a control when the text fits', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(96);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(96);

    render(<CollapsibleText value="Short explanation." />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
