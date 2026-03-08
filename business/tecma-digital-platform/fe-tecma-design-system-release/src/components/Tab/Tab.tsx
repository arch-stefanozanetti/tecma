import React, { useState } from 'react';

import classNames from 'classnames';

import TabButton from './TabButton';
import { DefaultProps } from '../../declarations';
import { IconName } from '../Icon/IconName';

// styles
import '../../styles/tab.scss';

// Required Props
interface TabRequiredProps {
  // The tabs to show
  items: Array<{
    title: string;
    iconName: IconName;
    content: string;
  }>;
}

// Optional Props
interface TabOptionalProps extends DefaultProps {
  // The tabs type
  type?: 'filled' | 'outlined';
  // If true, the tab is disabled
  disabled?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface TabProps extends TabRequiredProps, TabOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: TabOptionalProps = {
  'data-testid': 'tecma-tab',
  type: 'outlined',
  disabled: false,
};

/**
 * Tabbed interfaces are a way of navigating between multiple panels, reducing clutter and fitting more into a smaller space.
 */
const Tab: React.FC<TabProps> = ({ items, type, disabled, className, ...rest }) => {
  const classList = classNames('tecma-tab', { [`${type}`]: type }, className);
  const [activeTab, setActiveTab] = useState<number>(0);

  const handleTabButtonClick = (index: number) => {
    setActiveTab(index);
  };

  return (
    <div className={classList} {...rest}>
      <nav>
        <ul>
          {items.length > 0 &&
            items.map((item, index) => (
              <TabButton
                label={item.title}
                iconName={item.iconName}
                isActive={index === activeTab}
                onClick={() => handleTabButtonClick(index)}
                disabled={disabled}
                key={item.title}
              />
            ))}
        </ul>
      </nav>
      <section>
        <div>{items[activeTab].content}</div>
      </section>
    </div>
  );
};

Tab.defaultProps = defaultProps as Partial<TabOptionalProps>;

const TabSpace = Object.assign(Tab, {
  Button: TabButton,
});

export { TabSpace as Tab };
