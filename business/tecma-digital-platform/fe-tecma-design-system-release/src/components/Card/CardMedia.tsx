import React, { ReactNode } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/card.scss';

// Required Props
interface CardMediaRequiredProps {}

// Optional Props
interface CardMediaOptionalProps extends DefaultProps {
  children?: ReactNode;
}

// Combined required and optional props to build the full prop interface
export interface CardMediaProps extends CardMediaRequiredProps, CardMediaOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: CardMediaOptionalProps = {
  'data-testid': 'tecma-card-media',
  className: undefined,
  style: undefined,
};

const CardMedia: React.FC<CardMediaProps> = ({ className, style, children, ...rest }) => {
  const classList = classNames('tecma-card-media', className);
  return (
    <div className={classList} style={style} {...rest}>
      {children}
    </div>
  );
};

CardMedia.defaultProps = defaultProps as Partial<CardMediaOptionalProps>;

export default React.memo(CardMedia);
