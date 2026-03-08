import React, { MouseEventHandler, ReactNode, useRef, useState } from 'react';

import classNames from 'classnames';
import { Transition } from 'react-transition-group';

import AccordionHeader from './AccordionHeader';
import { DefaultProps } from '../../declarations/defaultProps';
import { IconName } from '../Icon/IconName';

// styles
import '../../styles/accordion.scss';

// Required Props
interface AccordionContentRequiredProps {}

// Optional Props
interface AccordionContentOptionalProps extends DefaultProps {
  // The title of the accordion header
  title?: string;
  // A component to show instead of the default accordion header
  headerComponent?: ReactNode;
  // The icon to show when accordion is closed
  iconOnClose?: IconName;
  // The icon to show when accordion is open
  iconOnOpen?: IconName;
  // If true the accordion is open
  open?: boolean;
  // If true, the accordion is disabled
  disabled?: boolean;
  // The action to perform on click
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLDivElement>;
  children?: ReactNode;
  panelClassName?: string;
  animationTimeMillis?: number;
  animationExitTimeMillis?: number;
}

// Combined required and optional props to build the full prop interface
export interface AccordionContentProps extends AccordionContentRequiredProps, AccordionContentOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: AccordionContentOptionalProps = {
  'data-testid': 'tecma-accordion-content',
  open: false,
  disabled: false,
  iconOnClose: 'arrow-up',
  iconOnOpen: 'arrow-down',
};

const DEFAULT_ANIMATION_TIME = 350;

// Inspired from https://github.com/reactstrap/reactstrap/blob/5108720a117af3a3742bb0c39b49ef32a48313b0/src/Collapse.js
const transitionStatusToClassHash = {
  entering: 'collapsing',
  entered: 'collapse open',
  exiting: 'collapsing',
  exited: 'collapse',
};

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  (
    {
      className,
      panelClassName,
      title,
      headerComponent,
      children,
      open,
      disabled,
      onClick,
      iconOnClose,
      iconOnOpen,
      animationTimeMillis,
      animationExitTimeMillis,
      ...rest
    },
    ref,
  ) => {
    const classList = classNames('tecma-accordion-content', className);
    const panelClassList = classNames('tecma-accordion-content-panel', { open }, panelClassName);

    const animationTime = open
      ? animationTimeMillis || DEFAULT_ANIMATION_TIME
      : animationExitTimeMillis || animationTimeMillis || DEFAULT_ANIMATION_TIME;

    const [contentHeight, setContentHeight] = useState<null | number>(open ? null : 0);

    const contentRef = useRef<HTMLDivElement>(null);

    return (
      <div ref={ref} className={classList} {...rest}>
        <AccordionHeader
          title={title as string}
          isOpen={open as boolean}
          onClick={onClick as MouseEventHandler}
          iconOnClose={iconOnClose as IconName}
          iconOnOpen={iconOnOpen as IconName}
          disabled={disabled as boolean}
          headerComponent={headerComponent}
        />
        <Transition
          in={open}
          nodeRef={contentRef}
          onEntering={() => {
            const height = contentRef.current?.clientHeight;
            setContentHeight(height ?? null);
          }}
          onEntered={() => {
            setContentHeight(null);
          }}
          onExiting={() => {
            const height = contentRef.current?.clientHeight;
            setContentHeight(height ?? null);
          }}
          onExited={() => {
            setContentHeight(0);
          }}
          timeout={{
            appear: animationTime,
            enter: animationTime,
          }}
        >
          {(status) => {
            return (
              <div
                className={classNames('tecma-accordion-content-panel-wrapper', transitionStatusToClassHash[status])}
                style={{
                  transition: `height ${animationTime}ms ease-in-out`,
                  ...(contentHeight != null && {
                    height: contentHeight ?? 'unset',
                  }),
                }}
              >
                <div data-testid='tecma-accordion-content-panel' className={panelClassList} ref={contentRef}>
                  {children}
                </div>
              </div>
            );
          }}
        </Transition>
      </div>
    );
  },
);

AccordionContent.defaultProps = defaultProps as Partial<AccordionContentOptionalProps>;

export default AccordionContent;
