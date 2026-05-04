import type { ButtonHTMLAttributes } from 'react';

import { joinClasses } from '../utils/joinClasses.js';

export type ButtonVariant = 'default' | 'ghost' | 'outline' | 'link' | 'primary' | 'destructive';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<Exclude<ButtonVariant, 'primary'>, string> = {
  default:
    'bg-primary text-primary-foreground shadow hover:opacity-90 disabled:pointer-events-none disabled:opacity-50',
  destructive:
    'bg-destructive text-destructive-foreground shadow-sm hover:opacity-90 disabled:pointer-events-none disabled:opacity-50',
  ghost: 'text-muted-foreground hover:text-foreground hover:underline',
  outline:
    'border border-input bg-background text-foreground shadow-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50',
  link: 'text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'min-h-11 px-4 py-2 text-sm',
  sm: 'min-h-9 rounded-md px-3 text-xs',
  lg: 'min-h-12 rounded-md px-8 text-base',
  icon: 'h-11 w-11 shrink-0 rounded-md p-0',
};

export const Button = ({
  className,
  type = 'button',
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps) => {
  const resolvedVariant = variant === 'primary' ? 'default' : variant;
  const isLinkish = resolvedVariant === 'ghost' || resolvedVariant === 'link';
  const fullWidth = resolvedVariant === 'default' && size === 'default';

  return (
    <button
      className={joinClasses(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        variantClasses[resolvedVariant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        isLinkish ? '' : '',
        className,
      )}
      type={type}
      {...props}
    />
  );
};
