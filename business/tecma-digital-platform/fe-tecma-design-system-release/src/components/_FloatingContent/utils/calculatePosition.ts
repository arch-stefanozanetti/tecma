import { CSSProperties } from 'react';

import { Position } from '../../../declarations/position';

export interface ElementPosition {
  x: number;
  top: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
  y: number;
  right: number;
}

export interface ContentPosition {
  height: number;
  width: number;
}

export const calculatePosition = (
  triggerPosition: ElementPosition,
  floatingContentPosition: ContentPosition,
  position: Position,
  triggerParentValues?: ElementPosition,
  arrow?: boolean,
  offset = 0,
  fixed = false,
): { floatingContentStyle: CSSProperties; arrowStyle: CSSProperties } => {
  const { clientHeight, clientWidth } = document.body;
  const { x, top, bottom, left, width, height, y, right } = triggerPosition;
  const { pageYOffset } = window;

  const nextStyle: {
    top?: string;
    bottom?: number;
    left?: number;
    right?: number;
    transform?: string;
    minWidth: number | 0;
  } = { minWidth: width };
  const arrowStyle: { left?: number; right?: number } = {};
  if (position === 'left' || position === 'right') {
    const floatingContentHeight = floatingContentPosition.height;
    nextStyle.bottom = clientHeight - y - height - pageYOffset;
    if (floatingContentHeight !== height) {
      nextStyle.bottom += height / 2 - floatingContentHeight / 2;
    }

    if (position === 'left') {
      nextStyle.right = clientWidth - x;
      if (arrow) {
        nextStyle.right += 10;
        arrowStyle.right = -10;
      }
      if (triggerParentValues) {
        nextStyle.right = clientWidth - triggerParentValues.left;
      }
    } else {
      nextStyle.left = width + x;
      if (arrow) {
        nextStyle.left += 10;
        arrowStyle.left = -10;
      }
      if (triggerParentValues) {
        nextStyle.left = clientWidth - triggerParentValues.right;
      }
    }
    return { floatingContentStyle: nextStyle, arrowStyle };
  }
  if (position.includes('bottom')) {
    if (fixed) {
      nextStyle.bottom = clientHeight - bottom - offset;
    } else {
      nextStyle.bottom = clientHeight - bottom - pageYOffset - offset;
    }
    /**
     * if the floating content should consider the parent dimension, it is required to calculate the correct dimension
     * based on parent dimension
     */
    if (triggerParentValues) {
      nextStyle.bottom -= triggerParentValues.bottom - bottom;
    }
    if (arrow) {
      nextStyle.bottom -= 10;
    }
    nextStyle.transform = 'translate(0%, 100%)';
  }

  if (position.includes('top')) {
    if (fixed) {
      nextStyle.bottom = clientHeight - top + offset;
    } else {
      nextStyle.bottom = clientHeight - top - pageYOffset + offset;
    }
    if (arrow) {
      nextStyle.bottom += 10;
    }
  }
  if (position.includes('right')) {
    nextStyle.right = right - width;
    if (arrow) {
      nextStyle.right -= 10;
      arrowStyle.right = width / 2 - 8;
    }
  }
  if (position.includes('center')) {
    const floatingContentWidth = floatingContentPosition.width;
    if (floatingContentWidth < width) {
      nextStyle.left = x;
    } else {
      const widthCalc = (floatingContentWidth - width) / 2;
      nextStyle.left = left - widthCalc;
    }
  }
  if (position.includes('left')) {
    nextStyle.left = left;
    if (arrow) {
      nextStyle.left -= 10;
      arrowStyle.left = width / 2 + 10;
    }
  }
  return { floatingContentStyle: nextStyle, arrowStyle };
};
