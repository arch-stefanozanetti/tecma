import React, { Children, cloneElement, ReactElement } from 'react';

import classNames from 'classnames';

import { SidebarContent } from './components/SidebarContent';
import { SidebarFooter } from './components/SidebarFooter';
import { SidebarHeader } from './components/SidebarHeader';
import { DefaultProps } from '../../declarations/defaultProps';
import { BasePosition } from '../../declarations/position';

// styles
import '../../styles/sidebar.scss';

// Required Props
interface SidebarRequiredProps {
  // Defines whether the sidebar is open or closed
  isOpen: boolean;
}

// Optional Props
interface SidebarOptionalProps extends DefaultProps {
  // The Sidebar component can use both Sidebar.Header,Sidebar.Content, Sidebar.footer and any HTML element as child
  children?: Array<ReactElement> | ReactElement;
  // Defines the sidebar position
  position?: BasePosition;
  // Defines the sidebar width in REM
  width?: number;
  // Defines the sidebar height in REM
  height?: number;
  // Defines the sidebar's type
  type?: 'shrinkable' | 'offcanvas';
  // Callback to perform on backdrop click
  onBackdropClick?: () => void;
  // The handler to be performed when clicking on the sidebar toggle
  onToggle?: () => void;
}

// Combined required and optional props to build the full prop interface
export interface SidebarProps extends SidebarRequiredProps, SidebarOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: SidebarOptionalProps = {
  'data-testid': 'tecma-sidebar',
  position: 'right',
  type: 'shrinkable',
};

/**
 * A panel which slides in from the edge of the screen.
 */
const Sidebar: React.FC<SidebarProps> = ({
  className,
  position,
  width,
  height,
  children,
  isOpen,
  onToggle,
  type,
  onBackdropClick,
  ...rest
}) => {
  const classList = classNames('tecma-sidebar', position && `tecma-sidebar-${position}`, { isOpen }, className);
  const containerClassList = classNames(
    'tecma-sidebar-container',
    position && `tecma-sidebar-container-${position}`,
    { [`${type}`]: type },
    { isOpen },
  );
  const widthStyle = width && { width: `${width}rem` };
  const heightStyle = height && { height: `${height}rem` };

  return (
    <div className={containerClassList} onClick={isOpen ? onBackdropClick : undefined} role='presentation'>
      <div className={classList} style={{ ...widthStyle, ...heightStyle }} {...rest}>
        {Children.map(children, (child) => cloneElement(child as ReactElement, { isOpen, onToggle, position }))}
      </div>
    </div>
  );
};

Sidebar.defaultProps = defaultProps as Partial<SidebarOptionalProps>;

const SidebarComponent = Object.assign(Sidebar, {
  Header: SidebarHeader,
  Content: SidebarContent,
  Footer: SidebarFooter,
});

export { SidebarComponent as Sidebar };
