import React, { ReactNode } from 'react';

import classNames from 'classnames';

import { DefaultProps, SizeStandard, Colors, BasePosition } from '../../declarations';
import { Icon } from '../Icon';

// styles
import '../../styles/radioButton.scss';

// Required Props
interface RadioButtonRequiredProps {
  // The function to perform on radioButton click
  onChange: () => void;
  // The label to show close to the radio button
  label: string | ReactNode;
}

// Optional Props
interface RadioButtonOptionalProps extends DefaultProps {
  // Specifies whether the radio is selected
  checked?: boolean;
  // Defines the radio button's size, can be `small`, `medium`, `large`
  size?: SizeStandard;
  // Defines the radio button color, can be default, primary, secondary, info, warning, success, danger
  color?: Colors;
  // If true, the radioButton is errored
  errored?: boolean;
  // Disables the Radiobutton
  disabled?: boolean;
  // The label position
  labelPosition?: BasePosition;
  // Select type of radio button
  type?: 'radio-card';
}

// Combined required and optional props to build the full prop interface
export interface RadioButtonProps extends RadioButtonRequiredProps, RadioButtonOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: RadioButtonOptionalProps = {
  'data-testid': 'tecma-radioButton',
  checked: false,
  size: 'medium',
  color: 'primary',
  errored: false,
  disabled: false,
  labelPosition: 'right',
  type: undefined,
};

const RadioButton: React.FC<RadioButtonProps> = ({
  onChange,
  checked,
  size,
  color,
  errored,
  disabled,
  label,
  labelPosition,
  className,
  type,
  ...rest
}) => {
  const classList = classNames(
    'tecma-radioButton',
    { checked },
    { [`${color}`]: color },
    { [`${size}`]: size },
    { [`${type}`]: type },
    { [`${labelPosition}`]: labelPosition },
    { errored },
    { disabled },
    className,
  );
  return (
    <div className={classList} onClick={onChange} aria-label='radioButton' onKeyDown={onChange} role='button' tabIndex={0} {...rest}>
      {type === 'radio-card' && checked && <Icon iconName='check' size={size} />}
      {type !== 'radio-card' && (
        <div className='radioButton-container'>
          <div className='radioButton-element' />
        </div>
      )}
      <span className='radioButton-content'>{label}</span>
    </div>
  );
};

RadioButton.defaultProps = defaultProps as Partial<RadioButtonOptionalProps>;

/**
 * Radio buttons allow a user to select a single option from a list of predefined options.
 * @deprecated use `RadioGroup` and `Radio` instead
 */
export default React.memo(RadioButton);
