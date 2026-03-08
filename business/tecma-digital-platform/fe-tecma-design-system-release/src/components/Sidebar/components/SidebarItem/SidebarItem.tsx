import React from 'react';

import classNames from 'classnames';

import { BasePosition, DefaultProps } from '../../../../declarations';
import { MuiPlacement } from '../../../../declarations/position';
import { Icon } from '../../../Icon';
import { IconName } from '../../../Icon/IconName';
import { Tooltip } from '../../../Tooltip';

// styles
import '../../../../styles/sidebarItem.scss';

// Required Props
interface SidebarItemRequiredProps {
  // The action to perform on item click
  onClick: React.MouseEventHandler<HTMLLIElement>;
  // The icon to show
  iconName: IconName;
  // The label to show
  label: string;
}

// Optional Props
interface SidebarItemOptionalProps extends DefaultProps {
  // Defines whether the sidebar is open or closed
  isOpen?: boolean;
  // Defines the tooltip position
  position?: BasePosition;
  // The sidebar item parent element
  parentRef?: HTMLElement | null;
}

// Combined required and optional props to build the full prop interface
export interface SidebarItemProps extends SidebarItemRequiredProps, SidebarItemOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: SidebarItemOptionalProps = {
  'data-testid': 'tecma-sidebarItem',
};

const SidebarItem: React.FC<SidebarItemProps> = ({ onClick, iconName, label, isOpen, position, parentRef, className, ...rest }) => {
  const classList = classNames('tecma-sidebarItem', className);

  const tooltipPosition = {
    right: 'left',
    left: 'right',
    top: 'bottom',
    bottom: 'top',
  };

  return (
    <Tooltip disableFocusListener placement={position ? (tooltipPosition[position] as MuiPlacement) : 'right'} title={label} {...rest}>
      <li onClick={onClick} role='presentation' className={classList}>
        {iconName && <Icon iconName={iconName} />}
        {isOpen && <span>{label}</span>}
      </li>
    </Tooltip>
  );
};

SidebarItem.defaultProps = defaultProps as Partial<SidebarItemOptionalProps>;

export default React.memo(SidebarItem);
