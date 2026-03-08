import React, { useState, ReactElement, isValidElement } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { Button } from '../Button';
import { Icon } from '../Icon';
import DrawerAccordion from './DrawerAccordion';
import DrawerNestedContent from './DrawerNestedContent';
import { IconProps } from '../Icon/Icon';

import type { IconName } from '../Icon/IconName';

// Required Props
interface DrawerItemRequiredProps {
  // The label to show
  label: string;
}

// Optional Props
interface DrawerItemOptionalProps extends DefaultProps {
  // The action to perform on item click
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  // The icon to show
  iconName?: IconName;
  rightIcon?: IconName | ReactElement<IconProps>;
  menuLayout?: 'accordion' | 'page';
  children?: React.ReactNode;
  description?: string;
}

// Combined required and optional props to build the full prop interface
export interface DrawerItemProps extends DrawerItemRequiredProps, DrawerItemOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: DrawerItemOptionalProps = {
  'data-testid': 'tecma-drawerItem',
};

const DrawerItem: React.FC<DrawerItemProps> = ({
  onClick,
  iconName,
  label,
  className,
  rightIcon,
  children,
  description,
  menuLayout,
  ...rest
}) => {
  const classList = classNames('tecma-drawer-item', className);
  const [subMenuOpen, setSubMenuOpen] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (menuLayout) {
      setSubMenuOpen(true);
    }
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <>
      {children && menuLayout !== 'page' ? (
        <DrawerAccordion headerIcon={iconName} headerLabel={label}>
          {children}
        </DrawerAccordion>
      ) : (
        <Button onClick={handleClick} iconName={iconName} className={classList} color='transparent' iconSize='medium' {...rest}>
          <span className='item-text-container'>
            <span className='item-text-container-label'>{label}</span>
            {description && <span className='item-description'>{description}</span>}
          </span>

          {rightIcon
            ? (isValidElement(rightIcon)
              ? rightIcon
              : <Icon className='tecma-drawer-item-right-icon' iconName={rightIcon as IconName} />)
            : null}
        </Button>
      )}
      {children && menuLayout === 'page' && (
        <DrawerNestedContent label={label} open={subMenuOpen} onNestedDrawerClose={() => setSubMenuOpen(false)}>
          <div onClick={() => setSubMenuOpen(false)} onKeyDown={() => setSubMenuOpen(false)} role='button' tabIndex={0}>
            {children}
          </div>
        </DrawerNestedContent>
      )}
    </>
  );
};

DrawerItem.defaultProps = defaultProps as Partial<DrawerItemOptionalProps>;

export default React.memo(DrawerItem);
