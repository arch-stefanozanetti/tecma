import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { Button } from '../Button';

// styles
import '../../styles/drawer.scss';

// Required Props
interface DrawerHeaderRequiredProps {
  // The function to be performed when clicking on close icon
  onClose: () => void;
}

// Optional Props
interface DrawerHeaderOptionalProps extends DefaultProps {
  // The label to show
  label?: string;
  isNestedHeader?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface DrawerHeaderProps extends DrawerHeaderRequiredProps, DrawerHeaderOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: DrawerHeaderOptionalProps = {
  'data-testid': 'tecma-drawerHeader',
};

const DrawerHeader: React.FC<DrawerHeaderProps> = ({ onClose, label, isNestedHeader, className, ...rest }) => {
  const classList = classNames('tecma-drawerHeader', className, {
    'nested-header': isNestedHeader,
  });

  return (
    <div className={classList} {...rest}>
      <span>{label}</span>
      <Button className='close-drawer-button' iconName={isNestedHeader ? 'chevron-left' : 'x'} onClick={onClose} color='inverse' />
    </div>
  );
};

DrawerHeader.defaultProps = defaultProps as Partial<DrawerHeaderOptionalProps>;

export default React.memo(DrawerHeader);
