import { RefObject, useEffect, useState } from 'react';

/**
 * Returns the scale factor required for the children element to match the width of the wrapper
 * element.
 *
 * @param wrapperRef - Ref for the parent element
 * @param childRef - Ref for the child element
 * @param gap - The desired left & right space between the children element and the wrapper in
 * pixels.
 * @param deps - Dependencies array used for recalculating.
 * @returns - Scale factor if applicable or null.
 */
export const useScaleFactor = (wrapperRef: RefObject<HTMLElement>, childRef: RefObject<HTMLElement>, gap: number, deps: unknown[]) => {
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    if (!childRef.current || !wrapperRef.current) {
      return;
    }

    const childrenWidth = childRef.current.offsetWidth;
    const parentWidth = wrapperRef.current.offsetWidth;

    if (childrenWidth !== 0 && parentWidth !== 0) {
      if (gap * 2 < parentWidth) {
        setScale(parentWidth - gap * 2 < childrenWidth ? (parentWidth - gap * 2) / childrenWidth : 1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childRef, wrapperRef, gap, ...deps]);

  return scale;
};
