import React, { ReactNode } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/card.scss';

// Required Props
interface CardContainerRequiredProps {}

// Optional Props
interface CardContainerOptionalProps extends DefaultProps {
  children?: ReactNode;
}

// use the optional prop interface to define the default props
const defaultProps: CardContainerOptionalProps = {
  'data-testid': 'tecma-card-container',
  className: undefined,
  style: undefined,
};
// Combined required and optional props to build the full prop interface
export interface CardContainerProps extends CardContainerRequiredProps, CardContainerOptionalProps {}

const CardContainer: React.FC<CardContainerProps> = ({ className, children, style, ...rest }) => {
  const classList = classNames('tecma-card-container', className);
  return (
    <div className={classList} style={style} {...rest}>
      {children}
    </div>
  );
};

CardContainer.defaultProps = defaultProps as Partial<CardContainerOptionalProps>;

export default React.memo(CardContainer);
