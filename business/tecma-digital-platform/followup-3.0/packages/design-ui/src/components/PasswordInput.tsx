import { useState, type InputHTMLAttributes } from 'react';

import { Icon } from '@followup/design-icons';

import { joinClasses } from '../utils/joinClasses.js';

import type { InputSize } from './Input.js';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  inputSize?: InputSize;
  invalid?: boolean;
};

const sizeHeights: Record<InputSize, string> = {
  sm: 'h-9 min-h-9 px-2.5 pr-11 text-sm',
  default: 'h-11 min-h-11 px-3 pr-12 text-sm',
  lg: 'h-12 min-h-12 px-4 pr-14 text-base',
};

export const PasswordInput = ({
  className,
  inputSize = 'default',
  invalid = false,
  ...props
}: PasswordInputProps) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative w-full">
      <input
        className={joinClasses(
          'w-full rounded-lg border bg-background text-foreground outline-none transition',
          'placeholder:text-muted-foreground',
          'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
          invalid ? 'border-destructive focus-visible:ring-destructive' : 'border-input',
          sizeHeights[inputSize],
          className,
        )}
        type={revealed ? 'text' : 'password'}
        {...props}
      />
      <button
        aria-label={revealed ? 'Nascondi password' : 'Mostra password'}
        className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setRevealed((prev) => !prev)}
        tabIndex={-1}
        type="button"
      >
        <Icon className="h-5 w-5" name={revealed ? 'eye-off' : 'eye'} size="sm" />
      </button>
    </div>
  );
};
