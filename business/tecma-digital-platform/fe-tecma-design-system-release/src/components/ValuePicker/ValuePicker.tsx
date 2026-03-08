import React, { ReactElement, useCallback } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { Button } from '../Button';
import { IconName } from '../Icon/IconName';

// styles
import '../../styles/valuePicker.scss';

type ValuePickerValue = string | number;

interface ValuePickerOptions<T extends ValuePickerValue> {
  value: T;
  label: string;
  disabled?: boolean;
}

// Required Props
interface ValuePickerRequiredProps<T extends ValuePickerValue> {
  options: ValuePickerOptions<T>[];
  onChange: (nextValue: T) => void;
  value: T | null;
}

// Optional Props
export interface ValuePickerOptionalProps extends DefaultProps {
  leftIcon?: IconName;
  rightIcon?: IconName;
  onPrevClick?: () => void;
  onNextClick?: () => void;
  outlined?: boolean;
  loop?: boolean;
  placeholder?: string;
}

// Combined required and optional props to build the full prop interface
export interface ValuePickerProps<T extends ValuePickerValue> extends ValuePickerRequiredProps<T>, ValuePickerOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: ValuePickerOptionalProps = {
  'data-testid': 'tecma-valuePicker',
  leftIcon: 'arrow-left',
  rightIcon: 'arrow-right',
  outlined: false,
};

const ValuePicker = <T extends ValuePickerValue>({
  options,
  value,
  leftIcon,
  rightIcon,
  onPrevClick,
  onNextClick,
  onChange,
  outlined,
  className,
  loop,
  placeholder,
  ...rest
}: ValuePickerProps<T>) => {
  const classList = classNames('tecma-valuePicker', { outlined }, className);

  const shouldShowPlaceholder = placeholder && value === null;
  const classListContainer = classNames('valuePicker-container', {
    disabled: shouldShowPlaceholder,
  });

  const selectedValueIndex = options.findIndex((option) => option.value === value);

  const getTranslateValue = useCallback((itemIndex: number) => -(selectedValueIndex - itemIndex) * 100, [selectedValueIndex]);

  const handleNextClick = useCallback(() => {
    const nextIndex = loop ? (selectedValueIndex + 1) % options.length : Math.min(options.length - 1, selectedValueIndex + 1);
    if (onNextClick) {
      onNextClick();
    }
    onChange(options[nextIndex]?.value);
  }, [loop, onChange, onNextClick, options, selectedValueIndex]);

  const handlePrevClick = useCallback(() => {
    const nextIndex = loop
      ? ((selectedValueIndex < 0 ? 0 : selectedValueIndex) + options.length - 1) % options.length
      : Math.max(0, selectedValueIndex - 1);
    if (onPrevClick) {
      onPrevClick();
    }
    onChange(options[nextIndex]?.value);
  }, [loop, onChange, onPrevClick, options, selectedValueIndex]);

  return (
    <div className={classList} {...rest}>
      <Button
        className='prev-button'
        iconName={leftIcon}
        onClick={handlePrevClick}
        outlined={outlined}
        size='large'
        disabled={!loop && selectedValueIndex <= 0}
      />
      <div className={classListContainer}>
        {placeholder && (
          <p
            style={{
              transform: `translateX(${getTranslateValue(shouldShowPlaceholder ? selectedValueIndex : selectedValueIndex - 1)}%)`,
            }}
          >
            {placeholder}
          </p>
        )}
        {options.map(({ value: curValue, label }, index) => {
          return (
            <p key={curValue} style={{ transform: `translateX(${getTranslateValue(index)}%)` }}>
              {label}
            </p>
          );
        })}
      </div>
      <Button
        className='next-button'
        iconName={rightIcon}
        onClick={handleNextClick}
        outlined={outlined}
        size='large'
        disabled={!loop && selectedValueIndex === options.length - 1}
      />
    </div>
  );
};

ValuePicker.defaultProps = defaultProps as Partial<ValuePickerOptionalProps>;

export default React.memo(ValuePicker) as unknown as {
  <T extends ValuePickerValue>({ ...rest }: ValuePickerProps<T>): ReactElement;
  defaultProps: Partial<ValuePickerOptionalProps>;
};
