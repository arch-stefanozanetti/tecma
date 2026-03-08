import { useState } from 'react';

/**
 * Hook for picking a value on a given list
 *
 * @param current - the selected value in the list.
 * @param currentIndex - the index of the selected value in the list.
 * @param previous - function for moving to the previous value in the list.
 * @param next - function for moving to the next value in the list.
 * @returns - an object containing current, currentIndex, previous and next parameters
 */
export const useListValue = (list: Array<string | number>) => {
  const [selectedValue, setSelectedValue] = useState<number>(0);
  const current = list[selectedValue];
  return {
    current,
    currentIndex: selectedValue,
    previous: () => setSelectedValue((selectedValue + list.length - 1) % list.length),
    next: () => setSelectedValue((selectedValue + 1) % list.length),
  };
};
