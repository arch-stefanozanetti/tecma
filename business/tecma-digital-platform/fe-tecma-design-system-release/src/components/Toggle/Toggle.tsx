import React from 'react';

import classNames from 'classnames';

import { DefaultProps, SizeStandard } from '../../declarations';
import { Colors } from '../../declarations/colors';

// styles
import '../../styles/toggle.scss';

// Required Props
interface ToggleRequiredProps {
  // The toggle on change handler
  onChange: () => void;
}

// Optional Props
interface ToggleOptionalProps extends DefaultProps {
  // The toggle value, boolean
  value?: boolean;
  // Defines the toggle color, can be primary, secondary, info, warning, success, danger or transparent
  color?: Colors;
  // Disables the toggle
  disabled?: boolean;
  // Defines the toggle's size, can be `small`, `medium`, `large`
  size?: SizeStandard;
  // The toggle label
  label?: string;
  // A text to show as help
  helpText?: string;
  // If true, the toggle is on error
  error?: boolean;
  // If true, the toggle is inline
  inline?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface ToggleProps extends ToggleRequiredProps, ToggleOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: ToggleOptionalProps = {
  'data-testid': 'tecma-toggle',
  value: false,
  color: 'primary',
  disabled: false,
  size: 'medium',
};

const Toggle: React.FC<ToggleProps> = ({ value, onChange, color, disabled, size, className, label, helpText, error, inline, ...rest }) => {
  const classList = classNames(
    'tecma-toggle',
    { [`${color}`]: color },
    { active: value },
    { disabled },
    { size },
    { [`${size}`]: size },
    className,
  );

  const containerClass = classNames(
    'tecma-toggle-container',
    { 'tecma-toggle-container--inline': inline },
    className
  );

  return (
    <div
      className={containerClass}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      onClick={onChange}
      role='button'
      aria-label='toggle-button'
      onKeyDown={onChange}
      tabIndex={0}
    >
      {label && <span className='toggle-label'>{label}</span>}
      <div className={classList} {...rest}>
        <div className='toggle-element' />
      </div>
      {helpText && <span className={error ? 'toggle-helpText toggle-helpText-errored' : 'toggle-helpText'}>{helpText}</span>}
    </div>
  );
};

Toggle.defaultProps = defaultProps as Partial<ToggleOptionalProps>;

/**
 * The Toggle is a boolean input field mostly used to get a boolean-like response from the user:
 * *yes/no*, *true/false*, etc...
 */
export default React.memo(Toggle);
