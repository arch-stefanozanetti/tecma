import React from 'react';
import { Story, Meta } from '@storybook/react';
import NavigationItem, { NavigationItemProps } from '../components/NavigationItem/NavigationItem';
import { IconName } from '../components/Icon/IconName';

const Template: Story<NavigationItemProps> = (args) => (
  <div style={{ width: '300px', padding: '20px', backgroundColor: '#f5f5f5' }}>
    <NavigationItem {...args} />
  </div>
);

export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
Basic.args = {
  label: 'Dashboard',
  iconName: 'home' as IconName,
  onClick: () => console.log('Dashboard clicked'),
};

export const WithSubItems = Template.bind({});
WithSubItems.storyName = 'With Sub Items';
WithSubItems.args = {
  label: 'Sales',
  iconName: 'chart-bar' as IconName,
  onClick: () => console.log('Sales clicked'),
  hasSubItems: true,
  subItems: [
    {
      label: 'Quotes',
      onClick: () => console.log('Quotes clicked'),
    },
    {
      label: 'Proposals',
      onClick: () => console.log('Proposals clicked'),
      isActive: true,
    },
    {
      label: 'Contracts',
      onClick: () => console.log('Contracts clicked'),
    },
  ],
};

export const Active = Template.bind({});
Active.storyName = 'Active State';
Active.args = {
  label: 'Analytics',
  iconName: 'chart-line' as IconName,
  onClick: () => console.log('Analytics clicked'),
  isActive: true,
};

export const Collapsed = Template.bind({});
Collapsed.storyName = 'Collapsed State';
Collapsed.args = {
  label: 'Settings',
  iconName: 'cog' as IconName,
  onClick: () => console.log('Settings clicked'),
  isCollapsed: true,
};

export const WithActiveSubLabel = Template.bind({});
WithActiveSubLabel.storyName = 'With Active Sub Label';
WithActiveSubLabel.args = {
  label: 'Sales',
  iconName: 'chart-bar' as IconName,
  onClick: () => console.log('Sales clicked'),
  hasSubItems: true,
  activeSubLabel: 'Proposals',
  subItems: [
    {
      label: 'Quotes',
      onClick: () => console.log('Quotes clicked'),
    },
    {
      label: 'Proposals',
      onClick: () => console.log('Proposals clicked'),
      isActive: true,
    },
    {
      label: 'Contracts',
      onClick: () => console.log('Contracts clicked'),
    },
  ],
};

export default {
  title: 'Components/NavigationItem',
  component: NavigationItem,
  parameters: {
    componentSubtitle: 'NavigationItem component for sidebar navigation with support for dropdowns, icons, and collapsed states.',
  },
  argTypes: {
    label: {
      description: 'The text label for the navigation item',
      control: 'text',
    },
    iconName: {
      description: 'The icon to display',
      control: 'select',
      options: ['home', 'chart-bar', 'chart-line', 'cog', 'user', 'settings'],
    },
    onClick: {
      description: 'Callback function when the item is clicked',
      action: 'clicked',
    },
    isActive: {
      description: 'Whether the item is currently active',
      control: 'boolean',
    },
    hasSubItems: {
      description: 'Whether the item has sub-items',
      control: 'boolean',
    },
    isCollapsed: {
      description: 'Whether the sidebar is collapsed',
      control: 'boolean',
    },
    activeSubLabel: {
      description: 'Label of the active sub-item to show when collapsed',
      control: 'text',
    },
  },
} as Meta<typeof NavigationItem>;