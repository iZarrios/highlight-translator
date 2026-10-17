import {
  Check,
  Copy,
  Languages,
  LoaderCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CollapsibleText } from '@/components/collapsible-text';
import { Button } from '@/components/ui/button';
import { useLookupStore } from '@/entrypoints/highlight.content/store';
import {
  type LookupResult,
  useLookup,
} from '@/entrypoints/highlight.content/use-lookup';
import { isRectangleVisible, positionCard } from '@/selection/position-card';

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Copy"
      onClick={async () => {
        try {
          await copyText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1_200);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function providerLabel(provider: LookupResult['provider']): string {
  if (!provider) return 'Configured AI';
  const location =
    provider.location === 'device'
      ? 'This device'
      : provider.location === 'network'
        ? 'Local network'
        : 'Remote';
  return `${location} · ${provider.name}`;
}

export function LookupCard() {
  const selection = useLookupStore((state) => state.selection);
  const close = useLookupStore((state) => state.close);
  const result = useLookup(selection);
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const [anchorVisible, setAnchorVisible] = useState(true);

  useEffect(() => {
    if (!selection || !cardRef.current) return;
    const card = cardRef.current;
    let animationFrame: number | undefined;
    const updatePosition = () => {
      const selectionRectangle = selection.anchor.rectangle();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const visible =
        selectionRectangle !== undefined &&
        isRectangleVisible(selectionRectangle, viewport);
      setAnchorVisible(visible);
      if (!selectionRectangle || !visible) return;

      const bounds = card.getBoundingClientRect();
      setPosition(
        positionCard(
          selectionRectangle,
          { width: bounds.width, height: bounds.height },
          viewport,
        ),
      );
    };
    const schedulePositionUpdate = () => {
      if (animationFrame !== undefined)
        window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updatePosition);
    };
    const resizeObserver = new ResizeObserver(schedulePositionUpdate);

    updatePosition();
    resizeObserver.observe(card);
    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', schedulePositionUpdate, true);

    return () => {
      if (animationFrame !== undefined)
        window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', schedulePositionUpdate);
      window.removeEventListener('scroll', schedulePositionUpdate, true);
    };
  }, [selection]);

  if (!selection) return null;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Translation and explanation"
      aria-hidden={!anchorVisible}
      className="fixed z-[2147483647] w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-border bg-card font-sans text-foreground shadow-[0_18px_55px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-opacity duration-100"
      style={{
        left: position.left,
        top: position.top,
        opacity: anchorVisible ? 1 : 0,
        pointerEvents: anchorVisible ? 'auto' : 'none',
        visibility: anchorVisible ? 'visible' : 'hidden',
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <p className="line-clamp-2 min-w-0 text-xs leading-5 text-muted-foreground">
          {selection.text}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close"
          onClick={close}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="max-h-[min(480px,70vh)] overflow-y-auto">
        <section className="px-4 py-3" aria-labelledby="translation-title">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Languages className="size-3.5" />
            <h2 id="translation-title">
              Translation · {providerLabel(result.provider)}
            </h2>
          </div>
          {result.translation.status === 'loading' ? (
            <LoadingLine label="Translating with configured AI…" />
          ) : null}
          {result.translation.status === 'success' ? (
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-medium leading-7">
                {result.translation.value}
              </p>
              <CopyButton value={result.translation.value} />
            </div>
          ) : null}
          {result.translation.status === 'error' ? (
            <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              {result.translation.error}
            </p>
          ) : null}
        </section>

        <section
          className="border-t border-border px-4 py-3"
          aria-labelledby="explanation-title"
        >
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Sparkles className="size-3.5" />
            <h2 id="explanation-title">
              Explanation · {providerLabel(result.provider)}
            </h2>
          </div>
          {result.explanation.status === 'loading' ? (
            <LoadingLine label="Thinking about the context…" />
          ) : null}
          {result.explanation.status === 'success' ? (
            <div className="flex items-start justify-between gap-2">
              <CollapsibleText value={result.explanation.value} />
              <CopyButton value={result.explanation.value} />
            </div>
          ) : null}
          {result.explanation.status === 'error' ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              {result.explanation.error}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
