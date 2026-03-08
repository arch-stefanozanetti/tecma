import React, { ReactNode } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/card.scss';

// Required Props
interface CardFooterRequiredProps {}

// Optional Props
interface CardFooterOptionalProps extends DefaultProps {
  children?: ReactNode;
}

// Combined required and optional props to build the full prop interface
export interface CardFooterProps extends CardFooterRequiredProps, CardFooterOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: CardFooterOptionalProps = {
  'data-testid': 'tecma-card-footer',
  className: undefined,
  style: undefined,
};

const CardFooter: React.FC<CardFooterProps> = ({ className, children, style, ...rest }) => {
  const classList = classNames('tecma-card-footer', className);
  return (
    <footer className={classList} style={style} {...rest}>
      {children}
    </footer>
  );
};

CardFooter.defaultProps = defaultProps as Partial<CardFooterOptionalProps>;

export default React.memo(CardFooter);
