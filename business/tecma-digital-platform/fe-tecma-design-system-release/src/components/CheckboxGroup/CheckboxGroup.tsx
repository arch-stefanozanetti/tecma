import React from 'react';

import { FormControl, FormControlProps, FormGroup, FormHelperText, FormLabel } from '@mui/material';
import classNames from 'classnames';

import { DefaultProps, Orientation } from '../../declarations';

// styles
import '../../styles/checkboxGroup.scss';

// Required Props
interface CheckboxGroupRequiredProps {
  // Label to show as checkbox group legend
  label: string;
  // A text to show as help
  helpText?: string;
}

// Optional Props
interface CheckboxGroupOptionalProps extends DefaultProps {
  // The checkbox alignemnt
  orientation?: Orientation;
}

// Combined required and optional props to build the full prop interface
export interface CheckboxGroupProps extends CheckboxGroupRequiredProps, CheckboxGroupOptionalProps, FormControlProps {}

// use the optional prop interface to define the default props
const defaultProps: CheckboxGroupOptionalProps = {
  'data-testid': 'tecma-checkboxGroup',
  orientation: 'vertical',
};

const CheckboxGroup: React.FC<CheckboxGroupProps> = ({ label, helpText, orientation, className, children, ...rest }) => {
  const classList = classNames('tecma-checkboxGroup', orientation, className);
  return (
    <FormControl className={classList} component='fieldset' variant='standard' {...rest}>
      <FormLabel component='legend' focused={false}>
        {label}
      </FormLabel>
      <FormGroup>{children}</FormGroup>
      <FormHelperText>{helpText}</FormHelperText>
    </FormControl>
  );
};

CheckboxGroup.defaultProps = defaultProps as Partial<CheckboxGroupOptionalProps>;

export default React.memo(CheckboxGroup);
