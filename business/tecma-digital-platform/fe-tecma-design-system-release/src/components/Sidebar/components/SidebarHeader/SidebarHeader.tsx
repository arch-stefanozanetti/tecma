import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../../../declarations/defaultProps';
import { Button } from '../../../Button';
import { Icon } from '../../../Icon';
import { IconName } from '../../../Icon/IconName';

// styles
import '../../../../styles/sidebarHeader.scss';

// Required Props
interface SidebarHeaderRequiredProps {
  // The icon on witch the user click to toggle the sidebar when  it's closed
  toggleIconOnClose: IconName;
  // The icon on witch the user click to toggle the sidebar when  it's open
  toggleIconOnOpen: IconName;
}

// Optional Props
interface SidebarHeaderOptionalProps extends DefaultProps {
  // If provided, show an icon on top of the sidebar
  headerIcon?: IconName;
  // The label to show close to the toggleIcon when the sidebar it's open
  toggleLabel?: string;
  // The handler to be performed when clicking on the sidebar toggle
  onToggle?: () => void;
  // Defines whether the sidebar is open or closed
  isOpen?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface SidebarHeaderProps extends SidebarHeaderRequiredProps, SidebarHeaderOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: SidebarHeaderOptionalProps = {
  'data-testid': 'tecma-sidebarHeader',
};

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  headerIcon,
  toggleIconOnClose,
  toggleIconOnOpen,
  toggleLabel,
  onToggle,
  isOpen,
  className,
  ...rest
}) => {
  const classList = classNames('tecma-sidebarHeader', { isOpen }, className);

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      throw new Error('missing toggle function');
    }
  };

  return (
    <div className={classList} {...rest}>
      {headerIcon && <Icon iconName={headerIcon} size='large' />}
      <div className='sidebarHeader-toggleSection'>
        <span>{toggleLabel}</span>
        <Button iconName={isOpen ? toggleIconOnOpen : toggleIconOnClose} onClick={() => handleToggle()} link />
      </div>
    </div>
  );
};

SidebarHeader.defaultProps = defaultProps as Partial<SidebarHeaderOptionalProps>;

export default React.memo(SidebarHeader);
