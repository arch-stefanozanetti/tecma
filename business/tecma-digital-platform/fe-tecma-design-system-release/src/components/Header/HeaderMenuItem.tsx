import React, { memo } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { Button } from '../Button';

import type { IconName } from '../Icon/IconName';

interface MenuItemItemRequiredProps {}
interface MenuItemItemOptionalProps extends DefaultProps {
  onClick?: () => void;
  title?: string;
  subtitle?: string;
  iconName?: IconName;
}

export interface MenuItemItemProps extends MenuItemItemRequiredProps, MenuItemItemOptionalProps {}

const defaultProps: MenuItemItemOptionalProps = {
  'data-testid': 'tecma-header-menu-item',
};

const MenuItemItem: React.FC<MenuItemItemProps> = ({ children, id, style, className, iconName, title, subtitle, onClick, ...rest }) => {
  const classList = classNames('tecma-header-menu-item', className);

  return (
    <li id={id} style={style} className={classList} {...rest}>
      {onClick ? (
        <Button onClick={onClick} fluid color='transparent' iconName={iconName}>
          <span className='menu-item-title'>{title}</span>
          <span className='menu-item-subtitle'>{subtitle}</span>
        </Button>
      ) : (
        <div className='not-clickable-item'>
          <span className='menu-item-title'>{title}</span>
          <span className='menu-item-subtitle'>{subtitle}</span>
        </div>
      )}
    </li>
  );
};

MenuItemItem.defaultProps = defaultProps as Partial<MenuItemItemOptionalProps>;

export default memo(MenuItemItem);
