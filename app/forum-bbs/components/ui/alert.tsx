import * as React from 'react';
import { cn } from '@/forum-bbs/lib/utils';

type AlertVariant = 'default' | 'destructive' | 'warning';

function Alert({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & { variant?: AlertVariant }) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        'w-full border px-4 py-3 font-mono text-sm',
        variant === 'default' && 'border-border bg-card text-foreground',
        variant === 'destructive' && 'border-destructive bg-destructive/10 text-destructive',
        variant === 'warning' &&
          'border-[oklch(0.75_0.15_85)] bg-[oklch(0.75_0.15_85_/_0.1)] text-[oklch(0.8_0.14_85)]',
        className,
      )}
      {...props}
    />
  );
}

export { Alert };
