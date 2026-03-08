import React, { memo, MouseEventHandler, useState } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { Button } from '../Button';
import { DropDown } from '../DropDown';
import { Icon } from '../Icon';

import type { IconName } from '../Icon/IconName';

interface HeaderItemRequiredProps {}
interface HeaderItemOptionalProps extends DefaultProps {
  label?: string;
  iconName?: IconName;
  rightIconName?: IconName;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
}

export interface HeaderItemProps extends HeaderItemRequiredProps, HeaderItemOptionalProps {}

const defaultProps: HeaderItemOptionalProps = {
  'data-testid': 'tecma-header-item',
};

const HeaderItem: React.FC<HeaderItemProps> = ({ id, style, className, children, iconName, rightIconName, label, onClick, ...rest }) => {
  const classList = classNames('tecma-header-item', className);
  const [isDropDownOpen, setIsDropDownOpen] = useState<boolean>(false);
  const triggerClassList = classNames('tecma-header-item-trigger', { open: isDropDownOpen });

  const handleOnClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (onClick) {
      onClick(e);
    }
    setIsDropDownOpen(!isDropDownOpen);
  };

  return children ? (
    <DropDown
      id={id}
      style={style}
      className={classList}
      isOpen={isDropDownOpen}
      rotateIconOnToggle
      iconOnClose='chevron-down'
      position={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      triggerProps={{
        children: (
          <>
            {label && <span>{label}</span>}
            {iconName && <Icon iconName={iconName} />}
          </>
        ),
        onClick: handleOnClick,
        className: triggerClassList,
        color: 'transparent',
        iconSize: 'medium',
      }}
      onToggle={() => setIsDropDownOpen(!isDropDownOpen)}
      {...rest}
    >
      {children}
    </DropDown>
  ) : (
    <Button className={classList} iconName={iconName} color='transparent' onClick={onClick || (() => {})}>
      {label && <span>{label}</span>}
      {rightIconName && <Icon iconName={rightIconName} />}
    </Button>
  );
};

HeaderItem.defaultProps = defaultProps as Partial<HeaderItemOptionalProps>;

export default memo(HeaderItem);
