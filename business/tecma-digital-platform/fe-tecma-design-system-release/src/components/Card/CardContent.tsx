import React, { ReactNode } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/card.scss';

// Required Props
interface CardContentRequiredProps {}

// Optional Props
interface CardContentOptionalProps extends DefaultProps {
  children?: ReactNode;
}

// use the optional prop interface to define the default props
const defaultProps: CardContentOptionalProps = {
  'data-testid': 'tecma-card-content',
  className: undefined,
  style: undefined,
};
// Combined required and optional props to build the full prop interface
export interface CardContentProps extends CardContentRequiredProps, CardContentOptionalProps {}

const CardContent: React.FC<CardContentProps> = ({ className, children, style, ...rest }) => {
  const classList = classNames('tecma-card-content', className);
  return (
    <div className={classList} style={style} {...rest}>
      {children}
    </div>
  );
};

CardContent.defaultProps = defaultProps as Partial<CardContentOptionalProps>;

export default React.memo(CardContent);
