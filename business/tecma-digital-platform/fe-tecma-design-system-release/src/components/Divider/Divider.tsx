import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';

// styles
import '../../styles/divider.scss';

// Required Props
interface DividerRequiredProps {}

// Optional Props
interface DividerOptionalProps extends DefaultProps {
  // The direction type of divider
  type?: 'horizontal' | 'vertical';
}

// Combined required and optional props to build the full prop interface
export interface DividerProps extends DividerRequiredProps, DividerOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: DividerOptionalProps = {
  'data-testid': 'tecma-divider',
  type: 'horizontal',
};

const Divider: React.FC<DividerProps> = ({ type, className, ...rest }) => {
  const classList = classNames('tecma-divider', type, className);
  return <div className={classList} {...rest} />;
};

Divider.defaultProps = defaultProps as Partial<DividerOptionalProps>;

export default React.memo(Divider);
