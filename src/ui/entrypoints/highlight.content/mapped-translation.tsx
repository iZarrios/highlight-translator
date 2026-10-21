import { cn } from '@/ui/cn';
import type { TextSpan, WordGroup } from '@/word-mapping';

type Segment = { text: string; start: number; group?: number };

type ActiveGroupProps = {
  groups: WordGroup[];
  active: number | undefined;
  onActive(group: number | undefined): void;
};

const contains = (outer: TextSpan | undefined, inner: TextSpan) =>
  outer !== undefined && outer.start <= inner.start && inner.end <= outer.end;

/** Splits the translation into its word groups and the text between them. */
function translationSegments(
  translation: string,
  groups: WordGroup[],
): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  groups.forEach((group, index) => {
    const { start, end } = group.translation;
    if (start > cursor)
      segments.push({ text: translation.slice(cursor, start), start: cursor });
    segments.push({
      text: translation.slice(start, end),
      start,
      ...(group.source ? { group: index } : {}),
    });
    cursor = end;
  });
  if (cursor < translation.length)
    segments.push({ text: translation.slice(cursor), start: cursor });
  return segments;
}

function hoverProps(
  group: number,
  active: number | undefined,
  onActive: (group: number | undefined) => void,
) {
  return {
    'data-group': group,
    onMouseEnter: () => onActive(group),
    onMouseLeave: () => onActive(undefined),
    onClick: () => onActive(active === group ? undefined : group),
  };
}

/** The original text, with the source of the active translation word marked. */
export function SourceText({
  text,
  groups,
  active,
  onActive,
}: ActiveGroupProps & { text: string }) {
  const boundaries = new Set([0, text.length]);
  for (const { source } of groups) {
    if (!source) continue;
    boundaries.add(source.start);
    boundaries.add(source.end);
  }
  const points = [...boundaries].sort((left, right) => left - right);
  const activeSource =
    active === undefined ? undefined : groups[active]?.source;

  return (
    <p
      data-testid="source-text"
      className="max-h-32 min-w-0 overflow-y-auto text-sm leading-6 text-foreground"
    >
      {points.slice(0, -1).map((start, index) => {
        const span = { start, end: points[index + 1] ?? start };
        const value = text.slice(span.start, span.end);
        const group = groups.findIndex(({ source }) => contains(source, span));
        if (group === -1) return <span key={start}>{value}</span>;
        return (
          <span
            key={start}
            {...hoverProps(group, active, onActive)}
            className={cn(
              'cursor-pointer rounded-sm transition-colors',
              contains(activeSource, span) && 'bg-highlight',
            )}
          >
            {value}
          </span>
        );
      })}
    </p>
  );
}

/** The translation, with every mapped word linked to its source words. */
export function MappedTranslation({
  translation,
  groups,
  active,
  onActive,
}: ActiveGroupProps & { translation: string }) {
  return (
    <p className="text-lg font-medium leading-8">
      {translationSegments(translation, groups).map((segment) => {
        const { group } = segment;
        if (group === undefined)
          return <span key={segment.start}>{segment.text}</span>;
        return (
          <span
            key={segment.start}
            {...hoverProps(group, active, onActive)}
            className={cn(
              'cursor-pointer rounded-sm underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 transition-colors',
              active === group && 'bg-highlight',
            )}
          >
            {segment.text}
          </span>
        );
      })}
    </p>
  );
}
