import React, { Children, cloneElement, MouseEventHandler, ReactElement } from 'react';

import classNames from 'classnames';

import AccordionContent from './AccordionContent';
import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/accordion.scss';

// Required Props
interface AccordionRequiredProps {
  children: Array<ReactElement> | ReactElement;
}

// Optional Props
interface AccordionOptionalProps extends DefaultProps {
  // A number or array of numbers to indicate which accordion should be open
  openPanels?: number[] | number;
  // The action to perform on accordion click
  onClick?: (e: MouseEventHandler<HTMLButtonElement>, newActivePanel: number) => void;
}

// Combined required and optional props to build the full prop interface
export interface AccordionProps extends AccordionRequiredProps, AccordionOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: AccordionOptionalProps = {
  'data-testid': 'tecma-accordion',
};

/**
 * An accordion is a vertical stack of interactive headings used to toggle the display of further information; each item can be 'collapsed' with just a short label visible or 'expanded' to show the full content.
 */
const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(({ className, openPanels, children, onClick, ...rest }, ref) => {
  const classList = classNames('tecma-accordion', className);

  return (
    <div ref={ref} className={classList} {...rest}>
      {Children.map(children, (child, index) =>
        cloneElement(child as ReactElement, {
          open: Array.isArray(openPanels) ? openPanels?.includes(index) : openPanels === index,
          internalid: index,
          onClick: (e: MouseEventHandler<HTMLButtonElement>): void => onClick && onClick(e, index),
        }),
      )}
    </div>
  );
});

Accordion.defaultProps = defaultProps as Partial<AccordionOptionalProps>;

const AccordionSpace = Object.assign(Accordion, {
  Content: AccordionContent,
});

export { AccordionSpace as Accordion };
