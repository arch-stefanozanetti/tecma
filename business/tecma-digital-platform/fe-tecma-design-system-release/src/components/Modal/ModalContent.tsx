import React, { ReactNode, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/modal.scss';

// Required Props
interface ModalContentRequiredProps {}

// Optional Props
interface ModalContentOptionalProps extends DefaultProps {
  children?: ReactNode;
  showScrollShadows?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface ModalContentProps extends ModalContentRequiredProps, ModalContentOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: ModalContentOptionalProps = {
  'data-testid': 'tecma-modal-content',
  showScrollShadows: false,
};

const ModalContent: React.FC<ModalContentProps> = ({ className, children, style, showScrollShadows, ...rest }) => {
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
      }, 1000);

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

  const classList = classNames('tecma-modal-content', className);

  return (
    <>
      {showScrollShadows && (
        <>
          <div
            ref={topShadowRef}
            className='modal-scroll-shadow top'
            style={{
              opacity: scrollState.canScrollUp ? 1 : 0,
            }}
          />
          <div
            ref={bottomShadowRef}
            className='modal-scroll-shadow bottom'
            style={{
              opacity: scrollState.canScrollDown ? 1 : 0,
            }}
          />
        </>
      )}
      <div
        style={{ ...style }}
        className={classList}
        {...rest}
        ref={contentRef}
        onScroll={showScrollShadows ? updateScrollState : undefined}
      >
        {children}
      </div>
    </>
  );
};

ModalContent.defaultProps = defaultProps as Partial<ModalContentOptionalProps>;

export default React.memo(ModalContent);
