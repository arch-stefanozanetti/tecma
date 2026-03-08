import React, { ReactNode } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/card.scss';

// Required Props
interface CardHeaderRequiredProps {}

// Optional Props
interface CardHeaderOptionalProps extends DefaultProps {
  children?: ReactNode;
}

// Combined required and optional props to build the full prop interface
export interface CardHeaderProps extends CardHeaderRequiredProps, CardHeaderOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: CardHeaderOptionalProps = {
  'data-testid': 'tecma-card-header',
  className: undefined,
  style: undefined,
};

const CardHeader: React.FC<CardHeaderProps> = ({ className, style, children, ...rest }) => {
  const classList = classNames('tecma-card-header', className);
  return (
    <div className={classList} style={style} {...rest}>
      {children}
    </div>
  );
};

CardHeader.defaultProps = defaultProps as Partial<CardHeaderOptionalProps>;

export default React.memo(CardHeader);
