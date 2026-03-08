import React from 'react';
import classNames from 'classnames';
import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/textArea.scss';

// Required Props
interface TextAreaRequiredProps {}

// Optional Props
interface TextAreaOptionalProps extends DefaultProps {
  // If defined, shows a placeholder into the textarea
  placeholder?: string;
  // Defines the max length for the textarea
  maxlength?: number;
  // If true, the textarea allows to exceed the maxlength
  allowExceedMaxLength?: boolean;
  // If true, the textarea is disabled
  disabled?: boolean;
  // If true, the textArea is invalid
  invalid?: boolean;
  // The label to show on top of the textarea
  label?: string;
  // The extra label to show on top of the textarea
  extraLabel?: string;
  // The value of the textarea
  value?: string;
  // The callback to perform on textarea change
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  // If true, the textarea is required
  required?: boolean;
  // The help text to show below the textarea
  helpText?: string;
  // The status of the textarea
  status?: 'error';
}

// Combined required and optional props to build the full prop interface
export interface TextAreaProps extends TextAreaRequiredProps, TextAreaOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: TextAreaOptionalProps = {
  'data-testid': 'tecma-textArea',
  placeholder: '',
  maxlength: undefined,
  disabled: false,
  invalid: false,
  allowExceedMaxLength: false,
};

const TextArea = React.forwardRef<HTMLDivElement, TextAreaProps>(
  (
    {
      placeholder,
      maxlength,
      allowExceedMaxLength,
      disabled,
      invalid,
      label,
      extraLabel,
      className,
      value,
      onChange,
      required,
      helpText,
      status,
      ...rest
    },
    ref,
  ) => {
    const classList = classNames('tecma-textArea', { invalid, [`${status}`]: status }, className);

    return (
      <div className={classList} ref={ref}>
        {label && (
          <span className='textArea-label'>
            {label} {extraLabel && <span className='textArea-extra-label'>{extraLabel}</span>}
            {required && '*'}
          </span>
        )}
        <textarea
          placeholder={placeholder}
          maxLength={allowExceedMaxLength ? undefined : maxlength}
          disabled={disabled}
          value={value}
          onChange={onChange}
          {...rest}
        />
        {(helpText || maxlength) && (
          <footer>
            {helpText && <span className='textArea-helpText'>{helpText}</span>}

            {maxlength && (
              <span className='textArea-counter'>
                {value?.length ?? 0}/{maxlength}
              </span>
            )}
          </footer>
        )}
      </div>
    );
  },
);

TextArea.defaultProps = defaultProps as Partial<TextAreaOptionalProps>;

export default React.memo(TextArea);
