import React, { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { Position } from '../../declarations/position';
import { Portal } from '../_Portal';
import { calculatePosition } from './utils/calculatePosition';
// styles
import '../../styles/floatingContent.scss';
// Required Props
interface FloatingContentRequiredProps {
  trigger: React.ReactNode;
  isShown: boolean;
  children: React.ReactNode;
  onToggle: () => void;
}
// Optional Props
interface FloatingContentOptionalProps extends DefaultProps {
  position?: Position;
  triggerClassName?: string;
  parentElement?: HTMLElement | null;
  action?: 'click' | 'hover';
  // Defines a number in pixel to possibly separate the popup from the trigger
  offset?: number;
  /**
   * if true, it shows an arrow for the floating content. The floatingContent arrow takes the className passed to the floatingContent component
   * to help in arrow css customization
   */
  arrow?: boolean;
  /**
   * If the `action` prop is set to `click`, it's possible to define if the `onToggle` callback should be performed
   * when clicking outside of the trigger
   */
  clickOutsideToToggle?: boolean;
  // If true, it will place the element fixed
  fixed?: boolean;
}
// Combined required and optional props to build the full prop interface
export interface FloatingContentProps extends FloatingContentRequiredProps, FloatingContentOptionalProps {}
// use the optional prop interface to define the default props
const defaultProps: FloatingContentOptionalProps = {
  'data-testid': 'tecma-floatingContent',
  position: 'bottom-left',
  action: 'click',
  parentElement: undefined,
  arrow: false,
  clickOutsideToToggle: true,
  offset: 0,
};

const FloatingContent: React.FC<FloatingContentProps> = ({
  trigger,
  children,
  className,
  onToggle,
  action,
  isShown,
  position,
  triggerClassName,
  clickOutsideToToggle,
  parentElement,
  arrow,
  offset,
  fixed,
  id,
  style,
  ...rest
}) => {
  const classList = classNames('tecma-floatingContent-container', { [`${position}`]: position }, className);
  const triggerClassList = classNames('floatingContent-trigger', triggerClassName);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const floatingContentRef = useRef<HTMLDivElement>(null);
  const [nextStyle, setNextStyle] = useState<{
    floatingContentStyle: CSSProperties;
    arrowStyle: CSSProperties;
  }>();
  const [mouseIsHovering, setMouseHover] = useState<boolean>(false);

  useEffect(() => {
    if (triggerRef.current && position && floatingContentRef.current && isShown) {
      const triggerPosition = triggerRef.current.getBoundingClientRect();
      const triggerParentValues = parentElement?.getBoundingClientRect();
      const floatingContentPosition = floatingContentRef.current.getBoundingClientRect();
      setNextStyle(calculatePosition(triggerPosition, floatingContentPosition, position, triggerParentValues, arrow, offset, fixed));
      /**
       * focusing element is required to handle the onBlur event on the floatingContent container
       * this way, clicking anywhere outside of it, the floatingContent will be closed
       */
      floatingContentRef.current.focus({ preventScroll: true });
    }
  }, [arrow, fixed, isShown, offset, parentElement, position]);

  // handles the clicks outside the floating content (and outside the current trigger)
  const clickOutsideHandler = useCallback(
    ({ target }: Event) => {
      if (
        isShown &&
        triggerRef.current &&
        !triggerRef.current.contains(target as Node) &&
        floatingContentRef.current &&
        !floatingContentRef.current.contains(target as Node)
      ) {
        onToggle();
      }
    },
    [isShown, onToggle],
  );

  // adds the click event listener when clickOutsideToToggle is true and when action is click
  useEffect(() => {
    if (triggerRef.current && floatingContentRef.current && clickOutsideToToggle && action === 'click') {
      document.addEventListener('click', clickOutsideHandler);
    }

    return () => {
      document.removeEventListener('click', clickOutsideHandler);
    };
  }, [clickOutsideToToggle, action, clickOutsideHandler]);
  /**
   * onMouseEnter and onMouseLeave functions are both used to handle the hover action by toggling the
   * mouseIsHovering state and firing the onToggle callback
   */
  const onMouseEnter = () => {
    if (!mouseIsHovering) {
      setMouseHover(true);
      onToggle();
    }
  };
  const onMouseLeave = () => {
    if (mouseIsHovering) {
      setMouseHover(false);
      onToggle();
    }
  };

  const actions = {
    onClick: action === 'click' ? onToggle : undefined,
    onMouseEnter: action === 'hover' ? onMouseEnter : undefined,
    onMouseLeave: action === 'hover' ? onMouseLeave : undefined,
    /**
     * When scrolling, onMouseLeave event is not triggered, so the floatingContent won't be toggled.
     * To handle this situation, onWheel is the right event to fire
     */
    onWheel: action === 'hover' ? onMouseLeave : undefined,
  };

  return (
    <>
      <span ref={triggerRef} className={triggerClassList} {...rest} {...actions}>
        {trigger}
      </span>
      {isShown && (
        <Portal id='tecma-floatingContent' className={fixed ? 'fixed' : ''}>
          <div className={classList} style={{ ...style, ...nextStyle?.floatingContentStyle }} id={id} ref={floatingContentRef}>
            {arrow && <div className={`floatingContent-arrow ${className || ''}`} style={{ ...nextStyle?.arrowStyle }} />}
            {children}
          </div>
        </Portal>
      )}
    </>
  );
};
FloatingContent.defaultProps = defaultProps as Partial<DefaultProps>;
export default React.memo(FloatingContent);
