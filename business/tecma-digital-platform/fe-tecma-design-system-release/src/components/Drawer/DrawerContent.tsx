import React, { ReactNode, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';

// Required Props
interface DrawerContentRequiredProps {
  children: React.ReactNode;
}

// Optional Props
interface DrawerContentOptionalProps extends DefaultProps {
  showScrollShadows?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface DrawerContentProps extends DrawerContentRequiredProps, DrawerContentOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: DrawerContentOptionalProps = {
  'data-testid': 'tecma-drawer-content',
  showScrollShadows: false,
};

const DrawerContent: React.FC<DrawerContentProps> = ({ children, className, showScrollShadows, ...rest }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const topShadowRef = useRef<HTMLDivElement>(null);
  const bottomShadowRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    canScrollUp: false,
    canScrollDown: false,
  });

  const updateScrollState = () => {
    if (showScrollShadows && contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      const hasVerticalScroll = scrollHeight > clientHeight;

      setScrollState({
        canScrollUp: hasVerticalScroll && scrollTop > 0,
        canScrollDown: hasVerticalScroll && scrollTop + clientHeight < scrollHeight,
      });

      updateShadowPositions();
    }
  };

  const updateShadowPositions = () => {
    if (!contentRef.current || !topShadowRef.current || !bottomShadowRef.current) return;

    const rect = contentRef.current.getBoundingClientRect();

    topShadowRef.current.style.top = `${rect.top}px`;
    topShadowRef.current.style.left = `${rect.left}px`;
    topShadowRef.current.style.width = `${rect.width}px`;

    bottomShadowRef.current.style.top = `${rect.bottom - 20}px`;
    bottomShadowRef.current.style.left = `${rect.left}px`;
    bottomShadowRef.current.style.width = `${rect.width}px`;
  };

  useEffect(() => {
    const contentElement = contentRef.current;
    if (contentElement && showScrollShadows) {
      setTimeout(() => {
        updateScrollState();
      }, 100);

      contentElement.addEventListener('scroll', updateScrollState);
      window.addEventListener('resize', updateScrollState);
      window.addEventListener('scroll', updateShadowPositions);
    }

    return () => {
      if (contentElement && showScrollShadows) {
        contentElement.removeEventListener('scroll', updateScrollState);
        window.removeEventListener('resize', updateScrollState);
        window.removeEventListener('scroll', updateShadowPositions);
      }
    };
  }, [showScrollShadows]);

  const classList = classNames('tecma-drawer-content', className);

  return (
    <>
      {showScrollShadows && (
        <>
          <div
            ref={topShadowRef}
            className="drawer-scroll-shadow top"
            style={{
              opacity: scrollState.canScrollUp ? 1 : 0,
            }}
          />
          <div
            ref={bottomShadowRef}
            className="drawer-scroll-shadow bottom"
            style={{
              opacity: scrollState.canScrollDown ? 1 : 0,
            }}
          />
        </>
      )}
      <nav
        className={classList}
        {...rest}
        ref={contentRef}
        onScroll={showScrollShadows ? updateScrollState : undefined}
      >
        {children}
      </nav>
    </>
  );
};

DrawerContent.defaultProps = defaultProps as Partial<DrawerContentOptionalProps>;

export default React.memo(DrawerContent);
