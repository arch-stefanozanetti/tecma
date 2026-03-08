import { useMemo } from 'react';

function* counter() {
  let count = 0;

  while (true) {
    count += 1;
    yield count;
  }
}

const idGenerator = counter();

const generateId = () => idGenerator.next().value as unknown as number;

/**
 * Custom useId implementation for React 17 compatibility.
 * This generates unique IDs for components that need them.
 */
export const useId = () => {
  const id = useMemo(() => generateId(), []);
  return `tecma-${id}`;
};
