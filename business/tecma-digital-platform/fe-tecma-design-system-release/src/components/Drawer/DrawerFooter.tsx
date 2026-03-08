import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';

// Required Props
interface DrawerFooterRequiredProps {
  children: React.ReactNode;
}

// Optional Props
interface DrawerFooterOptionalProps extends DefaultProps {}

// Combined required and optional props to build the full prop interface
export interface DrawerFooterProps extends DrawerFooterRequiredProps, DrawerFooterOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: DrawerFooterOptionalProps = {
  'data-testid': 'tecma-drawer-footer',
};

const DrawerFooter: React.FC<DrawerFooterProps> = ({ children, className, ...rest }) => {
  const classList = classNames('tecma-drawer-footer', className);
  return (
    <div className={classList} {...rest}>
      {children}
    </div>
  );
};

DrawerFooter.defaultProps = defaultProps as Partial<DrawerFooterOptionalProps>;

export default React.memo(DrawerFooter);
