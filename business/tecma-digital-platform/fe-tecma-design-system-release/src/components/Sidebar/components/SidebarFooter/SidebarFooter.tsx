import React, { ReactElement } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../../../declarations';
import { Icon } from '../../../Icon';
import { IconName } from '../../../Icon/IconName';

// styles
import '../../../../styles/sidebarFooter.scss';

// Required Props
interface SidebarFooterRequiredProps {}

// Optional Props
interface SidebarFooterOptionalProps extends DefaultProps {
  // An icon to show
  iconName?: IconName;
  // Any html element
  children?: ReactElement;
  // Defines whether the sidebar is open or closed
  isOpen?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface SidebarFooterProps extends SidebarFooterRequiredProps, SidebarFooterOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: SidebarFooterOptionalProps = {
  'data-testid': 'tecma-sidebarFooter',
};

const SidebarFooter: React.FC<SidebarFooterProps> = ({ iconName, isOpen, className, children, ...rest }) => {
  const classList = classNames('tecma-sidebarFooter', { isOpen }, className);

  return (
    <div className={classList} {...rest}>
      {iconName && <Icon iconName={iconName} />}
      {children}
    </div>
  );
};

SidebarFooter.defaultProps = defaultProps as Partial<SidebarFooterOptionalProps>;

export default React.memo(SidebarFooter);
