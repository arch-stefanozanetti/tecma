import React from 'react';

import MaterialDrawer, { DrawerProps as MaterialDrawerProps } from '@mui/material/Drawer';
import classNames from 'classnames';

import DrawerAvatar from './DrawerAvatar';
import DrawerContent from './DrawerContent';
import DrawerFooter from './DrawerFooter';
import DrawerHeader from './DrawerHeader';
import DrawerItem from './DrawerItem';
import DrawerLanguages from './DrawerLanguages';
import { DefaultProps } from '../../declarations';

// styles
import '../../styles/drawer.scss';

// Required Props
interface DrawerRequiredProps {}

// Optional Props
interface DrawerOptionalProps extends DefaultProps, MaterialDrawerProps {}

// Combined required and optional props to build the full prop interface
export interface DrawerProps extends DrawerRequiredProps, DrawerOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: DrawerOptionalProps = {
  'data-testid': 'tecma-drawer',
};

const Drawer: React.FC<DrawerProps> = ({ children, className, ...rest }) => {
  const classList = classNames('tecma-drawer', className);
  return (
    <MaterialDrawer className={classList} {...rest}>
      {children}
    </MaterialDrawer>
  );
};

Drawer.defaultProps = defaultProps as Partial<DrawerOptionalProps>;
const DrawerComponent = Object.assign(Drawer, {
  Header: DrawerHeader,
  Item: DrawerItem,
  Content: DrawerContent,
  Languages: DrawerLanguages,
  Avatar: DrawerAvatar,
  Footer: DrawerFooter,
});

export { DrawerComponent as Drawer };
