import React from 'react';

import FormControlLabel from '@mui/material/FormControlLabel';
import MaterialRadio, { RadioProps as MaterialRadioProps } from '@mui/material/Radio';
import classNames from 'classnames';

import { DefaultProps, SizeStandard } from '../../declarations';

// styles
import '../../styles/radio.scss';

// Required Props
interface RadioRequiredProps {}

// Optional Props
interface RadioOptionalProps extends DefaultProps {
  label?: string;
  size?: SizeStandard;
}

// Combined required and optional props to build the full prop interface
export interface RadioProps extends RadioRequiredProps, RadioOptionalProps, Omit<MaterialRadioProps, 'size'> {}

// use the optional prop interface to define the default props
const defaultProps: RadioOptionalProps = {
  'data-testid': 'tecma-radio',
  size: 'medium',
};

interface CustomRadioProps extends Omit<MaterialRadioProps, 'size'> {
  // eslint-disable-next-line react/require-default-props
  size?: SizeStandard;
}

const CustomRadio = ({ size, ...props }: CustomRadioProps) => {
  return (
    <MaterialRadio
      disableRipple
      color='default'
      checkedIcon={
        <div className={classNames('radioButton-container', 'checked', size)}>
          <div className='radioButton-element' />
        </div>
      }
      icon={
        <div className={classNames('radioButton-container', size)}>
          <div className='radioButton-element' />
        </div>
      }
      {...props}
    />
  );
};

const Radio: React.FC<RadioProps> = ({ className, value, label, ...rest }) => {
  const classList = classNames('tecma-radio', className);
  return <FormControlLabel className={classList} value={value} label={label} control={<CustomRadio {...rest} />} />;
};

Radio.defaultProps = defaultProps as Partial<RadioOptionalProps>;

export default React.memo(Radio);
