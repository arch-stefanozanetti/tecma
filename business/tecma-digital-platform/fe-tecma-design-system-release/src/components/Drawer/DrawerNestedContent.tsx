import React from 'react';

import classNames from 'classnames';

import DrawerContent from './DrawerContent';
import DrawerHeader from './DrawerHeader';
import { Divider } from '../Divider';

import type { DefaultProps } from '../../declarations';

// Required Props
interface DrawerNestedContentRequiredProps {
  // The nested drawer title to show
  label: string;
  // The function to be performed when clicking on close icon
  onNestedDrawerClose: () => void;
  open: boolean;
  children: React.ReactNode;
}

// Optional Props
interface DrawerNestedContentOptionalProps extends DefaultProps {}

// Combined required and optional props to build the full prop interface
export interface DrawerNestedContentProps extends DrawerNestedContentRequiredProps, DrawerNestedContentOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: DrawerNestedContentOptionalProps = {
  'data-testid': 'tecma-drawer-nested-content',
};

const DrawerNestedContent: React.FC<DrawerNestedContentProps> = ({ children, className, label, open, onNestedDrawerClose, ...rest }) => {
  const classList = classNames('tecma-drawer-nested-content', { open }, className);

  return (
    <div className={classList} {...rest}>
      <DrawerHeader label={label} onClose={onNestedDrawerClose} isNestedHeader />
      <Divider />
      <DrawerContent>{children}</DrawerContent>
    </div>
  );
};

DrawerNestedContent.defaultProps = defaultProps as Partial<DrawerNestedContentOptionalProps>;

export default React.memo(DrawerNestedContent);
