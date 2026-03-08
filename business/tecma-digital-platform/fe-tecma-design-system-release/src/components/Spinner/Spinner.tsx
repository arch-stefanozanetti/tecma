import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { SizeExtended } from '../../declarations/size';
import { Icon, IconURLContext } from '../Icon';

// styles
import '../../styles/spinner.scss';

// Required Props
interface SpinnerRequiredProps {}

export type SpinnerType = 'circle' | 'dotted' | 'dotted-circle';

// Optional Props
interface SpinnerOptionalProps extends DefaultProps {
  size?: SizeExtended;
  gradient?: boolean;
  type?: SpinnerType;
}

// Combined required and optional props to build the full prop interface
export interface SpinnerProps extends SpinnerRequiredProps, SpinnerOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: SpinnerOptionalProps = {
  size: 'medium',
  'data-testid': 'tecma-spinner',
  type: 'circle',
};

const Spinner: React.FC<SpinnerProps> = ({ size, gradient, type, className, ...rest }) => {
  const classList = classNames('tecma-spinner', { [`${size}`]: size }, { gradient }, { [`${type}`]: type }, className);

  return (
    <>
      {type === 'circle' && <div className={classList} {...rest} />}
      {type === 'dotted' && (
        <div className={classList} {...rest}>
          <div className='dot' />
          <div className='dot' />
          <div className='dot' />
        </div>
      )}
      {type === 'dotted-circle' && (
        <IconURLContext.Provider value="/ds-icons">
          <Icon className={classList} {...rest} iconName='dotted-circle' size={size} />
        </IconURLContext.Provider>
      )}
    </>
  );
};

Spinner.defaultProps = defaultProps as Partial<DefaultProps>;

export default React.memo(Spinner);
