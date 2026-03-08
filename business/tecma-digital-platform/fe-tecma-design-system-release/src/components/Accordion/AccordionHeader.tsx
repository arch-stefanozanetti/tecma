import React, { MouseEventHandler, ReactNode } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { Icon } from '../Icon';
import { IconName } from '../Icon/IconName';

// Required Props
interface AccordionHeaderRequiredProps {
  // The accordion title
  title: string;
  // The action to perform on click
  onClick: MouseEventHandler<HTMLButtonElement | HTMLDivElement>;
  // If true the accordion is open
  isOpen: boolean;
  // If true, the accordion is disabled
  disabled: boolean;
  // The icon to show when accordion is closed
  iconOnClose: IconName;
  // The icon to show when accordion is open
  iconOnOpen: IconName;
  // A component to show instead of the default accordion header
  headerComponent?: ReactNode;
}

// Optional Props
interface AccordionHeaderOptionalProps extends DefaultProps {}

// Combined required and optional props to build the full prop interface
export interface AccordionHeaderProps extends AccordionHeaderRequiredProps, AccordionHeaderOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: AccordionHeaderOptionalProps = {
  'data-testid': 'tecma-accordion-header',
};

const AccordionHeader = React.forwardRef<HTMLButtonElement, AccordionHeaderProps>(
  ({ className, title, disabled, iconOnClose, iconOnOpen, isOpen, onClick, headerComponent, ...rest }, ref) => {
    const classList = classNames('tecma-accordion-header', { disabled }, className);

    return (
      <button className={classList} onClick={onClick} type='button' disabled={disabled} ref={ref} {...rest}>
        {headerComponent || (
          <>
            <h2 className='accordion-header-title'>{title}</h2>
            <Icon iconName={isOpen ? (iconOnClose as IconName) : (iconOnOpen as IconName)} size='small' className='icon' />
          </>
        )}
      </button>
    );
  },
);

AccordionHeader.defaultProps = defaultProps as Partial<AccordionHeaderOptionalProps>;

export default AccordionHeader;
