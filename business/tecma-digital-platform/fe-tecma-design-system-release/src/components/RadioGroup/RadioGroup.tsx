import React from 'react';

import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import MaterialRadioGroup, { RadioGroupProps as MaterialRadioGroupProps } from '@mui/material/RadioGroup';
import classNames from 'classnames';

import { DefaultProps } from '../../declarations';

// styles
import '../../styles/radioGroup.scss';

// Required Props
interface RadioGroupRequiredProps {}

// Optional Props
interface RadioGroupOptionalProps extends DefaultProps {
  label?: string;
  labelId?: string;
  helperText?: string;
}

// Combined required and optional props to build the full prop interface
export interface RadioGroupProps extends RadioGroupRequiredProps, RadioGroupOptionalProps, MaterialRadioGroupProps {}

// use the optional prop interface to define the default props
const defaultProps: RadioGroupOptionalProps = {
  'data-testid': 'tecma-radioGroup',
};

const RadioGroup: React.FC<RadioGroupProps> = ({ className, children, label, labelId, defaultValue, row, helperText, ...rest }) => {
  const classList = classNames('tecma-radioGroup', className);
  return (
    <FormControl className={classList}>
      {label && <FormLabel id={labelId}>{label}</FormLabel>}
      <MaterialRadioGroup aria-labelledby={labelId} defaultValue={defaultValue} name='radio-buttons-group' row={row} {...rest}>
        {children}
      </MaterialRadioGroup>
      {helperText && <span className='helper-text'>{helperText}</span>}
    </FormControl>
  );
};

RadioGroup.defaultProps = defaultProps as Partial<RadioGroupOptionalProps>;

export default React.memo(RadioGroup);
