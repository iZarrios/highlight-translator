import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/ui/components/button';

export function CollapsibleText({ value }: { value: string }) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    if (expanded) return;
    const paragraph = paragraphRef.current;
    if (!paragraph) return;

    const measure = () => {
      setOverflows(paragraph.scrollHeight > paragraph.clientHeight + 1);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });

  return (
    <div className="min-w-0 flex-1">
      <p
        ref={paragraphRef}
        aria-live="polite"
        className={`whitespace-pre-wrap text-sm leading-6 ${
          expanded ? '' : 'line-clamp-6'
        }`}
      >
        {value}
      </p>
      {overflows || expanded ? (
        <Button
          type="button"
          variant="ghost"
          size="compact"
          className="mt-1 px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      ) : null}
    </div>
  );
}
