import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/ui/cn';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium',
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary px-3 py-2 text-primary-foreground hover:opacity-90',
        ghost: 'px-2 py-1.5 hover:bg-muted',
        danger: 'px-2 py-1.5 text-destructive hover:bg-destructive/10',
      },
      size: {
        default: 'h-9',
        icon: 'size-8 p-0',
        compact: 'h-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
