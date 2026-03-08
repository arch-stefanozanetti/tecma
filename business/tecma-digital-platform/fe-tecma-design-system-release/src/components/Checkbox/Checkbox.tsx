import React, { forwardRef } from 'react';

import { FormControlLabel } from '@mui/material';
import MaterialCheckbox, { CheckboxProps as MaterialCheckboxProps } from '@mui/material/Checkbox';
import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { SizeStandard } from '../../declarations/size';
import { Icon } from '../Icon';
import { IconName } from '../Icon/IconName';

// style
import '../../styles/checkbox.scss';

interface CheckboxRequiredProps {}

interface CheckboxOptionalProps extends DefaultProps {
  icon?: IconName | undefined;
  checkedIcon?: IconName | undefined;
  size?: SizeStandard;
}

export interface CustomCheckboxProps
  extends CheckboxOptionalProps,
    CheckboxRequiredProps,
    CheckboxProps,
    Omit<MaterialCheckboxProps, 'icon' | 'checkedIcon' | 'size'> {}

const defaultProps: CheckboxOptionalProps = {
  'data-testid': 'tecma-checkbox',
  icon: undefined,
  size: 'medium',
};

export interface CheckboxProps extends Omit<MaterialCheckboxProps, 'ref' | 'icon' | 'checkeIcon' | 'size'> {
  label?: string;
  labelPlacement?: 'end' | 'start' | 'top' | 'bottom';
  icon?: IconName | undefined;
  checkedIcon?: IconName | undefined;
  size?: SizeStandard;
  helpText?: string;
  status?: 'error' | 'warning';
}

const CustomCheckbox = forwardRef<HTMLInputElement, CustomCheckboxProps>(
  ({ icon, checkedIcon, size, helpText, status, className, ...props }, ref) => {
    const classList = classNames(
      {
        [`${status}`]: status,
      },
      'tecma-custom-checkbox',
    );
    const IconToShowOnCheck = icon ? (
      <Icon iconName={icon} filled />
    ) : (
      <div className='checkbox-element'>
        <Icon iconName='check' />
      </div>
    );
    return (
      <div className={classList}>
        <MaterialCheckbox
          inputRef={ref}
          color='default'
          {...props}
          icon={
            <div className={classNames('tecma-checkbox-container', size)}>
              {icon ? <Icon iconName={icon} /> : <div className='checkbox-element' />}
            </div>
          }
          checkedIcon={
            <div className={classNames('tecma-checkbox-container', 'checked', size)}>
              {checkedIcon ? <Icon iconName={checkedIcon} /> : IconToShowOnCheck}
            </div>
          }
        />
        {helpText && <span className={status === 'error' ? 'help-text-errored' : 'help-text'}>{helpText}</span>}
      </div>
    );
  },
);

/**
 * An input for choosing from predefined options.
 */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ label, labelPlacement, className, ...rest }, ref) => {
  const classList = classNames('tecma-checkbox', className);

  return (
    <FormControlLabel
      control={<CustomCheckbox ref={ref} {...rest} />}
      label={label}
      labelPlacement={labelPlacement}
      className={classList}
    />
  );
});

Checkbox.defaultProps = defaultProps as Partial<DefaultProps>;

export default Checkbox;
