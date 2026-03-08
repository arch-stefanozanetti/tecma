import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';

// styles
import '../../styles/missingPage.scss';

// Required Props
interface MissingPageRequiredProps {}

// Optional Props
interface MissingPageOptionalProps extends DefaultProps {
  dataTestId?: string;
}

// Combined required and optional props to build the full prop interface
export interface MissingPageProps extends MissingPageRequiredProps, MissingPageOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: MissingPageOptionalProps = {
  dataTestId: 'tecma-missingPage',
};

export const MissingPage: React.FC<MissingPageProps> = ({ className, dataTestId, ...rest }) => {
  const classList = classNames('tecma-missingPage', className);
  return (
    <div className={classList} data-testid={dataTestId} {...rest}>
      The page you are looking for does not exist. Please check the url.
    </div>
  );
};

MissingPage.defaultProps = defaultProps;
