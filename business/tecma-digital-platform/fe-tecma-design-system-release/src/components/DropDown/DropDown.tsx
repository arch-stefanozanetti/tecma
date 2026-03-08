import React, { ReactElement } from 'react';

import { PopoverOrigin } from '@mui/material';
import classNames from 'classnames';

import DropDownDivider from './DropDownDivider';
import DropDownItem from './DropDownItem';
import { DefaultProps } from '../../declarations';
import { Button } from '../Button';
import { ButtonProps } from '../Button/Button';
import { IconName } from '../Icon/IconName';
import { Popover } from '../Popover';

// styles
import '../../styles/dropDown.scss';

// Required Props
interface DropDownRequiredProps {
  children: React.ReactNode;
  // If true, the dropdown is open
  isOpen: boolean;
  // The callback to perform on dropdown open
  onToggle: () => void;
}

// Optional Props
interface DropDownOptionalProps extends DefaultProps {
  // The dropDown position
  position?: PopoverOrigin;
  // The icon to show on closed DropDown
  iconOnClose?: IconName;
  // The icon to show on open DropDown
  iconOnOpen?: IconName;
  // If provided, it will replace the default trigger (Button) with anything else
  trigger?: React.ReactElement;
  // TrasformOrigin: see PopOver
  transformOrigin?: PopoverOrigin;
  // The props for the dropdown trigger. As it is a Button, triggerProps match the Button props
  triggerProps?: ButtonProps;
  // If true will be used only iconOnClose and it will rotate it on open
  rotateIconOnToggle?: boolean;
  // If true, the icon will be positioned on the left side of the trigger
  leftIcon?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface DropDownProps extends DropDownRequiredProps, DropDownOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: DropDownOptionalProps = {
  className: undefined,
  id: undefined,
  style: undefined,
  'data-testid': 'tecma-DropDown',
  position: { vertical: 'bottom', horizontal: 'center' },
  transformOrigin: { vertical: 'top', horizontal: 'center' },
  iconOnOpen: 'arrow-up',
  iconOnClose: 'arrow-down',
};

/**
 * A menu in which options are hidden by default but can be shown by interacting with a button.
 */
const DropDown: React.FC<DropDownProps> = ({
  className,
  children,
  isOpen,
  position,
  transformOrigin,
  onToggle,
  triggerProps,
  iconOnOpen,
  iconOnClose,
  trigger,
  rotateIconOnToggle,
  leftIcon,
  ...rest
}) => {
  const classList = classNames('tecma-dropDown', { isOpen }, className);
  const triggerClassName = triggerProps?.className;
  const triggerClassList = classNames('dropDown-trigger', {
    isOpen,
    'rotate-icon-on-toggle': rotateIconOnToggle,
    [`${triggerClassName}`]: triggerClassName,
  });
  const triggerIcon = (() => {
    if (rotateIconOnToggle) {
      return iconOnClose;
    }
    return isOpen ? iconOnOpen : iconOnClose;
  })();
  const dropDownTrigger = (() => {
    if (triggerProps) {
      return <Button iconName={triggerIcon} {...(leftIcon ? {} : { rightIcon: true })} {...triggerProps} className={triggerClassList} />;
    }
    return null;
  })();
  return (
    <Popover
      isOpen={isOpen}
      position={position}
      transformOrigin={transformOrigin}
      onClose={onToggle}
      trigger={trigger || (dropDownTrigger as ReactElement)}
      className={classList}
      {...rest}
    >
      <ul>{children}</ul>
    </Popover>
  );
};

DropDown.defaultProps = defaultProps as Partial<DropDownOptionalProps>;

const DropDownSpace = Object.assign(DropDown, {
  Item: DropDownItem,
  Divider: DropDownDivider,
});

export { DropDownSpace as DropDown };
