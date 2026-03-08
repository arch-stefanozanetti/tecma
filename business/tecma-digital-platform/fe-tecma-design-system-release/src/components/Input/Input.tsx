import React, { ChangeEventHandler, InputHTMLAttributes, MouseEvent, ReactNode, forwardRef, useCallback, useState } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { SizeStandard } from '../../declarations/size';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { IconName } from '../Icon/IconName';

// styles
import '../../styles/input.scss';

// Required Props
interface InputRequiredProps {
  onChange: ChangeEventHandler<HTMLInputElement>;
}

type InputType = 'text' | 'number' | 'password';

// Optional Props
interface InputOptionalProps extends DefaultProps {
  // The input size
  size?: SizeStandard;
  // The input type
  type?: InputType;
  // The input status
  status?: 'error' | 'warning';
  // The text to show when input is errored
  helpText?: ReactNode;
  // The icon to show
  iconName?: IconName;
  // The icon to show on the left
  leftIconName?: IconName;
  // The icon to show on the right
  rightIconName?: IconName;
  // The callback to perform on left icon click
  onRightIconClick?: React.MouseEventHandler;
  // The callback to perform on icon click
  onIconClick?: React.MouseEventHandler;
  // The input placeholder
  placeholder?: string;
  // The input label
  label?: string;
  // The input label extra content
  extraLabel?: ReactNode;
  // Object of validation rules
  validators?: ValidatorsConfig;
  // Object of validations status (boolean)
  validatorResults?: ValidatorsResult;
}

// Combined required and optional props to build the full prop interface
export interface InputProps
  extends InputRequiredProps,
    InputOptionalProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type' | 'id' | 'size' | 'style' | 'onChange'> {}

// use the optional prop interface to define the default props
const defaultProps: InputOptionalProps = {
  'data-testid': 'tecma-input',
  size: 'medium',
  type: 'text',
  helpText: '',
  label: '',
};

type ValidatorsKeys = 'upperAndLower' | 'atLeastANumber' | 'atLeastASymbol' | 'minimumMaximumLength';

type ValidatorsObject = {
  [key in ValidatorsKeys]?: (str: string) => boolean;
};

type ValidatorsConfig = {
  [key in ValidatorsKeys]?: string;
};

export type ValidatorsResult = {
  [key in ValidatorsKeys]?: boolean;
};

const VALIDATORS: ValidatorsObject = {
  upperAndLower: (val: string) => {
    const containsUpper = /[A-Z]/.test(val);
    const containsLower = /[a-z]/.test(val);
    return containsUpper && containsLower;
  },
  atLeastANumber: (val: string) => {
    return /[0-9]/.test(val);
  },
  atLeastASymbol: (val: string) => {
    // This regular expression matches anything that isn't a letter or as digit
    return /[\W_]/.test(val);
  },
  minimumMaximumLength: (val: string) => {
    return val.length <= 20 && val.length > 7;
  },
};

export const getValidatorsPass = (str: string, validators: ValidatorsConfig): ValidatorsResult =>
  Object.fromEntries(Object.keys(validators).map((validatorKey) => [validatorKey, VALIDATORS[validatorKey](str)]));

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size,
      type,
      helpText,
      status,
      iconName,
      leftIconName,
      rightIconName,
      onIconClick,
      onChange,
      onRightIconClick,
      className,
      disabled,
      placeholder,
      label,
      extraLabel,
      id,
      style,
      validators,
      validatorResults,
      'data-testid': dataTestId,
      value,
      required,
      ...rest
    },
    ref,
  ) => {
    const [inputType, setInputType] = useState<InputType>(type || 'text');
    const classList = classNames(
      'tecma-input',
      `type-${type}`,
      {
        [`${size}`]: size,
        [`${status}`]: status,
        disabled,
      },
      className,
    );

    const inputClassList = classNames('input-container');

    const handleIconClick = useCallback(
      (e: MouseEvent) => {
        if (type === 'password') {
          if (inputType === 'password') {
            setInputType('text');
          } else {
            setInputType('password');
          }
        }
        if (onIconClick) {
          onIconClick(e);
        }
      },
      [inputType, onIconClick, type],
    );

    const passwordIcon = inputType === 'password' ? 'eye-off' : 'eye';

    const allValidatorsPass = validatorResults ? Object.values(validatorResults).every((val) => val) : null;

    const hasValue = Boolean(value && String(value).length);
    return (
      <div className={classList} id={id} style={style} data-testid={dataTestId}>
        {label && (
          <span className='input-label'>
            {label} {extraLabel && <span className='input-extra-label'>{extraLabel}</span>}
            {required && '*'}
          </span>
        )}
        <div className={inputClassList}>
          {leftIconName && <Icon iconName={leftIconName} size='small' />}
          <input
            placeholder={placeholder}
            onChange={onChange}
            type={inputType}
            data-valid={allValidatorsPass}
            value={value}
            ref={ref}
            disabled={disabled}
            {...rest}
          />
          {rightIconName && (
            <span className='input-right-icon' onClick={onRightIconClick}>
              <Icon iconName={rightIconName} size='small' />
            </span>
          )}
          {iconName && !onIconClick && <Icon iconName={iconName} />}
          {iconName && onIconClick && <Button className='input-button' iconName={iconName} onClick={handleIconClick} color='transparent' />}
          {status === 'error' && <Icon iconName='exclamation-circle' />}
          {type === 'password' && <Button className='input-button' iconName={passwordIcon} onClick={handleIconClick} color='transparent' />}
        </div>
        {helpText && <span className={status === 'error' ? 'help-text-errored' : 'help-text'}>{helpText}</span>}
        {validators && validatorResults && (
          <ul className='validators'>
            {Object.entries(validators).map(([validatorKey, validatorLabel]) => (
              <li
                className={classNames(
                  'validator',
                  hasValue && validatorResults && (validatorResults[validatorKey] ? 'validator-ok' : 'validator-ko'),
                )}
              >
                {(!hasValue || !validatorResults) && <Icon iconName='check-circle' size='small' />}
                {hasValue &&
                  validatorResults &&
                  (validatorResults[validatorKey] ? (
                    <Icon iconName='check-circle' filled size='small' />
                  ) : (
                    <Icon iconName='x-circle' filled size='small' />
                  ))}
                <span className='validator-label'>{validatorLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);

Input.defaultProps = defaultProps as Partial<InputOptionalProps>;

export default Input;
