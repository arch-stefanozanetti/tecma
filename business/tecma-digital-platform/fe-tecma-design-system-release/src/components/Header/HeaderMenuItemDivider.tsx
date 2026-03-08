import React, { memo } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';

export interface HeaderMenuItemDividerProps extends DefaultProps {}

const defaultProps: HeaderMenuItemDividerProps = {
  'data-testid': 'tecma-header-menu-item-divider',
};

const HeaderMenuItemDivider: React.FC<HeaderMenuItemDividerProps> = ({ className, style, ...rest }) => {
  const classList = classNames('tecma-header-menu-item-divider', className);
  return <div className={classList} style={style} {...rest} />;
};

HeaderMenuItemDivider.defaultProps = defaultProps as Partial<HeaderMenuItemDividerProps>;

export default memo(HeaderMenuItemDivider);
