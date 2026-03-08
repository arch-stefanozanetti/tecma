import React, { Children, ReactElement } from 'react';

import classNames from 'classnames';

import { DefaultProps, Colors, SizeStandard, Orientation } from '../../declarations';
import { Button } from '../Button';

// styles
import '../../styles/buttonGroup.scss';

// Required Props
interface ButtonGroupRequiredProps {}

// Optional Props
interface ButtonGroupOptionalProps extends DefaultProps {
  // Makes the button rounded
  rounded?: boolean;
  // Defines the buttons' color, can be default, primary, secondary, info, warning, success, danger or transparent
  color?: Colors;
  // Shows the outlines only
  outlined?: boolean;
  // Defines the buttons' size, can be `small`, `medium`, `large`
  size?: SizeStandard;
  // If true, the button is similar to a link
  link?: boolean;
  // Elements to show inside button group
  children?: Array<ReactElement>;
  // If true, the button is as wide as it's container
  fluid?: boolean;
  // The buttons alignemnt
  orientation?: Orientation;
  // If true, remove space between buttons
  segmented?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface ButtonGroupProps extends ButtonGroupRequiredProps, ButtonGroupOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: ButtonGroupOptionalProps = {
  'data-testid': 'tecma-buttonGroup',
  orientation: 'horizontal',
  fluid: false,
  outlined: false,
  size: 'medium',
  link: false,
  rounded: false,
  color: 'primary',
  segmented: false,
};

const ButtonGroup: React.FC<ButtonGroupProps> = ({ className, children, orientation, fluid, segmented, ...rest }) => {
  const classList = classNames('tecma-buttonGroup', { [`${orientation}`]: orientation }, { fluid }, { segmented }, className);
  return (
    <div className={classList} {...rest}>
      {Children.map(children, (child) => {
        if ((child as React.ReactElement).type === Button) {
          return React.cloneElement(child as ReactElement, { fluid, ...rest });
        }
        return console.warn('wrong type of component');
      })}
    </div>
  );
};

ButtonGroup.defaultProps = defaultProps as Partial<ButtonGroupOptionalProps>;

export default React.memo(ButtonGroup);
