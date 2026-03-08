import React, { ReactElement, useEffect, useRef } from 'react';

import MaterialPopover, { PopoverProps as MaterialPopoverProps, PopoverOrigin } from '@mui/material/Popover';
import classNames from 'classnames';

import { DefaultProps } from '../../declarations';

// styles
import '../../styles/popover.scss';

// Required Props
interface PopoverRequiredProps {
  // The element that trigger the popover
  trigger: ReactElement;
  // The function to perform on close. This component is stateless so it should change the Popover state as first thing.
  onClose: () => void;
}

// Optional Props
interface PopoverOptionalProps extends DefaultProps {
  // If true the popover is open
  isOpen?: boolean;
  //	This is the point on the popover which will attach to the trigger's origin.
  transformOrigin?: PopoverOrigin;
  // The Popover position.This is the point on the anchor where the popover's trigger will attach to.
  position?: PopoverOrigin;
}

// Combined required and optional props to build the full prop interface
export interface PopoverProps extends PopoverRequiredProps, PopoverOptionalProps, Omit<MaterialPopoverProps, 'open' | 'onClose'> {}

// use the optional prop interface to define the default props
const defaultProps: PopoverOptionalProps = {
  'data-testid': 'tecma-popover',
  isOpen: false,
  position: { vertical: 'top', horizontal: 'left' },
};

const Popover: React.FC<PopoverProps> = ({ trigger, isOpen, onClose, position, transformOrigin, className, children, ...rest }) => {
  const classList = classNames('tecma-popover', className);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('scroll', onClose);

      return () => window.removeEventListener('scroll', onClose);
    }
    return () => {};
  }, [isOpen, onClose]);
  return (
    <>
      {React.cloneElement(trigger, {
        ref,
        className: trigger ? classNames(trigger.props.className, 'popover-trigger') : 'popover-trigger',
      })}
      <MaterialPopover
        anchorEl={ref.current}
        anchorOrigin={position as PopoverOrigin}
        transformOrigin={transformOrigin}
        open={isOpen as boolean}
        onClose={onClose}
        classes={{ paper: classList }}
        disableScrollLock
        slotProps={{
          paper: {
            style: { minWidth: ref.current?.getBoundingClientRect().width },
          },
        }}
        {...rest}
      >
        {children}
      </MaterialPopover>
    </>
  );
};

Popover.defaultProps = defaultProps as Partial<PopoverOptionalProps>;

export default React.memo(Popover);
