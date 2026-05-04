import type { InputHTMLAttributes, ReactNode } from 'react';

import { joinClasses } from '../utils/joinClasses.js';

export type InputSize = 'sm' | 'default' | 'lg';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: InputSize;
  invalid?: boolean;
  endAdornment?: ReactNode;
}

const sizeHeights: Record<InputSize, string> = {
  sm: 'h-9 min-h-9 px-2.5 text-sm',
  default: 'h-11 min-h-11 px-3 text-sm',
  lg: 'h-12 min-h-12 px-4 text-base',
};

export const Input = ({
  className,
  inputSize = 'default',
  invalid = false,
  endAdornment,
  ...props
}: InputProps) => {
  const paddingEnd = endAdornment != null ? 'pr-11' : '';

  return (
    <div className="relative w-full">
      <input
        className={joinClasses(
          'w-full rounded-lg border bg-background text-foreground outline-none transition',
          'placeholder:text-muted-foreground',
          'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
          invalid ? 'border-destructive focus-visible:ring-destructive' : 'border-input',
          sizeHeights[inputSize],
          paddingEnd,
          className,
        )}
        {...props}
      />
      {endAdornment != null ? (
        <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground">
          {endAdornment}
        </span>
      ) : null}
    </div>
  );
};
