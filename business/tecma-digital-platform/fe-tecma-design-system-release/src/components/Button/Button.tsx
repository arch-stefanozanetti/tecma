import React, { MouseEventHandler } from 'react';

import classNames from 'classnames';

import { Colors } from '../../declarations/colors';
import { DefaultProps } from '../../declarations/defaultProps';
import { SizeStandard } from '../../declarations/size';
import { Icon } from '../Icon';
import { IconName } from '../Icon/IconName';
import Spinner, { SpinnerType } from '../Spinner/Spinner';

import '../../styles/button.scss';

interface ButtonRequiredProps {
  // The function to perform on button click
  onClick: MouseEventHandler<HTMLButtonElement>;
}
interface ButtonOptionalProps extends DefaultProps {
  // Disables the button
  disabled?: boolean;
  // Makes the button rounded
  rounded?: boolean;
  // Defines the button color, can be primary, secondary, info, warning, success, danger, transparent or inverse
  color?: Colors;
  // Shows the outlines only
  outlined?: boolean;
  // Defines the button's size, can be `small`, `medium`, `large`
  size?: SizeStandard;
  // If true, and iconName is defined, place the icon to the right of the text
  rightIcon?: boolean;
  // The icon to show in the button
  iconName?: IconName;
  // If provided, shows a loader into the button
  loader?: SpinnerType;
  // If true, the button is as wide as it's container
  fluid?: boolean;
  // Defines the icon's size, can be `small`, `medium`, `large`. If not provided, is equal to button size
  iconSize?: SizeStandard;
  // If true, the button is similar to a link
  link?: boolean;
}

type CustomHTMLButtonElementsProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'size' | 'color'>;

export interface ButtonProps extends ButtonOptionalProps, ButtonRequiredProps, CustomHTMLButtonElementsProps {}

const defaultProps: ButtonOptionalProps = {
  'data-testid': 'tecma-button',
  size: 'medium',
  color: 'primary',
  fluid: false,
  disabled: false,
  outlined: false,
  rightIcon: false,
  iconName: undefined,
  loader: undefined,
  iconSize: undefined,
  link: false,
  rounded: false,
};

/**
 * A button is a clickable element used to perform an action. It contains a text label and a supporting icon can be displayed.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { onClick, rounded, disabled, color, outlined, children, iconName, loader, rightIcon, size, fluid, iconSize, link, className, ...rest },
    ref,
  ) => {
    const classList = classNames(
      'tecma-button',
      { rounded },
      { disabled },
      { outlined },
      { fluid },
      { link },
      { [`${color}`]: color },
      { 'icon-on-right': rightIcon },
      { [`${size}`]: size },
      { 'icon-only': !children && iconName },
      className,
    );

    return (
      <button type='button' onClick={onClick} className={classList} disabled={disabled} {...rest} ref={ref}>
        {iconName && <Icon aria-label={iconName} iconName={iconName} size={iconSize} />}
        {loader && <Spinner type={loader} />}
        {children}
      </button>
    );
  },
);

Button.defaultProps = defaultProps as Partial<DefaultProps>;

export default Button;
