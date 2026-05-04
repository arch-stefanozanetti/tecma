export const joinClasses = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');
