import type { InputHTMLAttributes } from 'react';

import { joinClasses } from '../utils/joinClasses.js';

export type CheckboxLabelVariant = 'accent' | 'muted';

interface CheckboxWithLabelProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  labelVariant?: CheckboxLabelVariant;
}

export const CheckboxWithLabel = ({
  className,
  label,
  labelVariant = 'accent',
  id,
  ...props
}: CheckboxWithLabelProps) => {
  const inputId = id ?? props.name ?? undefined;
  const labelColor = labelVariant === 'muted' ? 'text-muted-foreground' : 'text-foreground';

  return (
    <label
      className={joinClasses(
        'mt-1 flex cursor-pointer items-center gap-2 text-sm',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background rounded-md',
        labelColor,
        className,
      )}
      htmlFor={inputId}
    >
      <input
        className={joinClasses(
          'size-4 shrink-0 rounded border border-input bg-background text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
        id={inputId}
        type="checkbox"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
};
