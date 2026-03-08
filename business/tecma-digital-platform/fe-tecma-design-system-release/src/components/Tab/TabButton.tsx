import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { Button } from '../Button';
import { IconName } from '../Icon/IconName';

// styles
import '../../styles/tab.scss';

// Required Props
interface TabButtonRequiredProps {
  // The tab label
  label: string;
  // Define if the tab is active
  isActive: boolean;
  // The callback to perform on tab click
  onClick: React.MouseEventHandler;
}

// Optional Props
interface TabButtonOptionalProps extends DefaultProps {
  // The tab icon
  iconName?: IconName;
  // If true, the tab is disabled
  disabled?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface TabButtonProps extends TabButtonRequiredProps, TabButtonOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: TabButtonOptionalProps = {
  'data-testid': 'tecma-tabButton',
  disabled: false,
};

const TabButton: React.FC<TabButtonProps> = ({ label, iconName, isActive, onClick, disabled, className, ...rest }) => {
  const classList = classNames('tecma-tabButton', { isActive }, className);

  return (
    <li className={classList} {...rest}>
      <Button iconName={iconName} onClick={onClick} color='transparent' disabled={disabled}>
        {label}
      </Button>
    </li>
  );
};

TabButton.defaultProps = defaultProps as Partial<TabButtonOptionalProps>;

export default React.memo(TabButton);
