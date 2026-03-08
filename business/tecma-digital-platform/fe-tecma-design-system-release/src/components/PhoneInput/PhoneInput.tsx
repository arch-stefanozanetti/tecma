import React, { forwardRef, useEffect, useRef } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { Input } from '../Input';
import { Select } from '../Select';
import { OptionSelect } from '../Select/Select';
import { Locales } from '../../constants/locales';
import { InputProps } from '../Input/Input';
import { phoneInputCountries, translateSelectedValue } from '../../helpers/phone-input';

// styles
import '../../styles/phoneInput.scss';

// Required Props
interface PhoneInputRequiredProps {
  // current language
  currentLanguage: Locales;
  // onChangeCountry function to run on select
  onChangeCountry: (newValue: OptionSelect | OptionSelect[]) => void;
  // the selected country
  selectedCountry: OptionSelect;
}

// Optional Props
interface PhoneInputOptionalProps extends DefaultProps {
  // The select label
  label?: string;
  direction?: 'vertical' | 'horizontal';
  menuPlacement?: 'bottom' | 'auto' | 'top';
}

// Combined required and optional props to build the full prop interface
export interface PhoneInputProps extends PhoneInputRequiredProps, PhoneInputOptionalProps, InputProps {}

// use the optional prop interface to define the default props
const defaultProps: PhoneInputOptionalProps = {
  'data-testid': 'tecma-phoneInput',
  direction: 'vertical',
};

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      className,
      currentLanguage,
      label,
      onChangeCountry,
      selectedCountry,
      extraLabel,
      direction = 'vertical',
      menuPlacement = 'bottom',
      helpText,
      required,
      ...rest
    },
    ref,
  ) => {
    const classList = classNames('tecma-phoneInput', className, {
      [direction]: direction,
    });
    const [containerWidth, setContainerWidth] = React.useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const updateContainerWidth = () => {
      setContainerWidth(containerRef.current?.clientWidth || 0);
    };

    useEffect(() => {
      updateContainerWidth();
      window.addEventListener('resize', updateContainerWidth);
      return () => {
        window.removeEventListener('resize', updateContainerWidth);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [containerRef.current]);

    return (
      <div className={classList}>
        {label && (
          <span className='tecma-phoneInput-label'>
            {label}
            {extraLabel && <span className='tecma-phoneInput-extra-label'>{extraLabel}</span>}
            {required && '*'}
          </span>
        )}
        <div className='container' ref={containerRef}>
          <Select
            options={phoneInputCountries(currentLanguage)}
            value={translateSelectedValue(selectedCountry, currentLanguage, direction === 'horizontal')}
            onChange={onChangeCountry}
            closeMenuOnSelect
            disabled={rest.disabled}
            menuPlacement={menuPlacement}
            dropDownWidth={containerWidth}
            isSearchable
          />
          <Input ref={ref} type='number' {...rest} />
        </div>
        {helpText && <span className={rest.status === 'error' ? 'help-text-errored' : 'help-text'}>{helpText}</span>}
      </div>
    );
  },
);

PhoneInput.defaultProps = defaultProps as Partial<PhoneInputOptionalProps>;

export default React.memo(PhoneInput);
