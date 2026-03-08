import React, { useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import { DefaultProps, BasePosition } from '../../../../declarations';
import { IconName } from '../../../Icon/IconName';
import SidebarItem from '../SidebarItem/SidebarItem';

// styles
import '../../../../styles/sidebarContent.scss';

// Required Props
interface SidebarContentRequiredProps {
  // An array of objects to show as Sidebar item on top of the Sidebar Content
  itemsOnTop: Array<{ icon: IconName; label: string; onClick: () => void }>;
}

// Optional Props
interface SidebarContentOptionalProps extends DefaultProps {
  // Defines whether the sidebar is open or closed
  isOpen?: boolean;
  // Defines the tooltip position
  position?: BasePosition;
  // An array of objects to show as Sidebar item on bottom of the Sidebar Content
  itemsOnBottom?: Array<{ icon: IconName; label: string; onClick: () => void }>;
}

// Combined required and optional props to build the full prop interface
export interface SidebarContentProps extends SidebarContentRequiredProps, SidebarContentOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: SidebarContentOptionalProps = {
  'data-testid': 'tecma-sidebarContent',
};

const SidebarContent: React.FC<SidebarContentProps> = ({ itemsOnTop, itemsOnBottom, isOpen, position, className, ...rest }) => {
  const classList = classNames('tecma-sidebarContent', { isOpen }, className);
  const navRef = useRef<HTMLSpanElement>(null);
  const [parentRef, setParentRef] = useState<HTMLElement | undefined>(undefined);

  useEffect(() => {
    if (navRef.current) setParentRef(navRef.current);
  }, []);

  return (
    <nav className={classList} {...rest} ref={navRef}>
      <ul>
        {itemsOnTop.map((item) => (
          <SidebarItem
            onClick={item.onClick}
            iconName={item.icon}
            label={item.label}
            position={position}
            isOpen={isOpen}
            parentRef={parentRef?.parentElement}
            key={item.label}
          />
        ))}
      </ul>
      <ul>
        {itemsOnBottom &&
          itemsOnBottom.length > 0 &&
          itemsOnBottom.map((item) => (
            <SidebarItem
              onClick={item.onClick}
              iconName={item.icon}
              label={item.label}
              position={position}
              isOpen={isOpen}
              parentRef={parentRef?.parentElement}
              key={item.label}
            />
          ))}
      </ul>
    </nav>
  );
};

SidebarContent.defaultProps = defaultProps as Partial<SidebarContentOptionalProps>;

export default React.memo(SidebarContent);
