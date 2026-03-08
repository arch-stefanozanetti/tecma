import React from 'react';

import classNames from 'classnames';

import { Avatar } from '../Avatar';

import type { DefaultProps } from '../../declarations';
import type { AvatarProps } from '../Avatar/Avatar';

// Required Props
interface DrawerAvatarRequiredProps {
  avatarProps: AvatarProps;
}

// Optional Props
interface DrawerAvatarOptionalProps extends DefaultProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

// Combined required and optional props to build the full prop interface
export interface DrawerAvatarProps extends DrawerAvatarRequiredProps, DrawerAvatarOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: DrawerAvatarOptionalProps = {
  'data-testid': 'tecma-drawer-avatar',
};

const DrawerAvatar: React.FC<DrawerAvatarProps> = ({ children, avatarProps, title, subtitle, className, ...rest }) => {
  const classList = classNames('tecma-drawer-avatar', className);
  return (
    <div className={classList} {...rest}>
      <Avatar size='large' {...avatarProps} />
      <div className='drawer-avatar-info'>
        {title && <span className='drawer-avatar-title'>{title}</span>}
        {subtitle && <span className='drawer-avatar-subtitle'>{subtitle}</span>}
      </div>
      {children && <div className='drawer-avatar-extra'>{children}</div>}
    </div>
  );
};

DrawerAvatar.defaultProps = defaultProps as Partial<DrawerAvatarOptionalProps>;

export default React.memo(DrawerAvatar);
