import React, { useState, useMemo } from 'react';
import { Story, Meta } from '@storybook/react';
import TecmaSidebarMobile, { TecmaSidebarMobileProps, TecmaSidebarMobileItem } from '../components/TecmaSidebarMobile/TecmaSidebarMobile';
import { TecmaSidebarNavigationItem } from '../components/TecmaSidebar/TecmaSidebar';
import { IconName } from '../components/Icon/IconName';

const Template: Story<TecmaSidebarMobileProps> = (args) => {
  const [activeItem, setActiveItem] = useState<string>('Apartments');

  const handleItemClick = (itemLabel: string) => {
    setActiveItem(itemLabel);
  };

  const enhancedItems = args.items.map((item) => ({
    ...item,
    isActive: item.label === activeItem,
    onClick: () => {
      handleItemClick(item.label);
      item.onClick();
    },
  }));

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: '20px', paddingBottom: '100px' }}>
        <h1>Content Area</h1>
        <p>Active Item: {activeItem}</p>
        <p>This is a mobile layout example. The sidebar is fixed at the bottom.</p>
      </div>
      <TecmaSidebarMobile {...args} items={enhancedItems} />
    </div>
  );
};

export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage (3 Visible + More)';
Basic.args = {
  items: [
    { label: 'Home', iconName: 'home' as IconName, onClick: () => console.log('Home clicked') },
    { label: 'Apartments', iconName: 'office-building' as IconName, onClick: () => console.log('Apartments clicked') },
    { label: 'Clients', iconName: 'users' as IconName, onClick: () => console.log('Clients clicked') },
    { label: 'Calendar', iconName: 'calendar' as IconName, onClick: () => console.log('Calendar clicked') },
  ],
};

export const WithActiveState = Template.bind({});
WithActiveState.storyName = 'With Active State (3 Visible + More)';
WithActiveState.args = {
  items: [
    { label: 'Home', iconName: 'home' as IconName, onClick: () => console.log('Home clicked') },
    { label: 'Apartments', iconName: 'office-building' as IconName, onClick: () => console.log('Apartments clicked') },
    { label: 'Clients', iconName: 'users' as IconName, onClick: () => console.log('Clients clicked') },
    { label: 'Calendar', iconName: 'calendar' as IconName, onClick: () => console.log('Calendar clicked') },
  ],
};

export const ThreeItems = Template.bind({});
ThreeItems.storyName = 'Three Items (All Visible + More)';
ThreeItems.args = {
  items: [
    { label: 'Home', iconName: 'home' as IconName, onClick: () => console.log('Home clicked') },
    { label: 'Apartments', iconName: 'office-building' as IconName, onClick: () => console.log('Apartments clicked') },
    { label: 'Clients', iconName: 'users' as IconName, onClick: () => console.log('Clients clicked') },
  ],
};

export const FiveItems = Template.bind({});
FiveItems.storyName = 'Five Items (First 3 + More, 5th in Drawer)';
FiveItems.args = {
  items: [
    { label: 'Home', iconName: 'home' as IconName, onClick: () => console.log('Home clicked') },
    { label: 'Apartments', iconName: 'office-building' as IconName, onClick: () => console.log('Apartments clicked') },
    { label: 'Clients', iconName: 'users' as IconName, onClick: () => console.log('Clients clicked') },
    { label: 'Reports', iconName: 'chart-bar' as IconName, onClick: () => console.log('Reports clicked') },
    { label: 'Calendar', iconName: 'calendar' as IconName, onClick: () => console.log('Calendar clicked') },
  ],
};

export const CustomItems = Template.bind({});
CustomItems.storyName = 'Custom Items (First 3 + More, 4th in Drawer)';
CustomItems.args = {
  items: [
    { label: 'Analytics', iconName: 'chart-bar' as IconName, onClick: () => console.log('Analytics clicked') },
    { label: 'Settings', iconName: 'cog' as IconName, onClick: () => console.log('Settings clicked') },
    { label: 'Notifications', iconName: 'bell' as IconName, onClick: () => console.log('Notifications clicked') },
    { label: 'Profile', iconName: 'user-circle' as IconName, onClick: () => console.log('Profile clicked') },
  ],
};

export const WithMoreDrawer = Template.bind({});
WithMoreDrawer.storyName = 'With More Drawer (First 3 + More, Items 5+ in Drawer)';
WithMoreDrawer.args = {
  items: [
    { label: 'Home', iconName: 'home' as IconName, onClick: () => console.log('Home clicked') },
    { label: 'Apartments', iconName: 'office-building' as IconName, onClick: () => console.log('Apartments clicked') },
    { label: 'Clients', iconName: 'users' as IconName, onClick: () => console.log('Clients clicked') },
    { label: 'Calendar', iconName: 'calendar' as IconName, onClick: () => console.log('Calendar clicked') },
    { label: 'Reports', iconName: 'chart-bar' as IconName, onClick: () => console.log('Reports clicked') },
    { 
      label: 'Sales', 
      iconName: 'chart-bar' as IconName, 
      onClick: () => console.log('Sales clicked'),
      subItems: [
        { label: 'Quotes', onClick: () => console.log('Quotes clicked') },
        { label: 'Proposals', onClick: () => console.log('Proposals clicked') },
        { label: 'Contracts', onClick: () => console.log('Contracts clicked') },
      ]
    },
    { label: 'Settings', iconName: 'cog' as IconName, onClick: () => console.log('Settings clicked') },
    { label: 'Profile', iconName: 'user-circle' as IconName, onClick: () => console.log('Profile clicked') },
  ],
};

export const LongLabels = Template.bind({});
LongLabels.storyName = 'Long Labels (64x64 buttons with text wrapping)';
LongLabels.args = {
  items: [
    { label: 'Home', iconName: 'home' as IconName, onClick: () => console.log('Home clicked') },
    { label: 'Apartments', iconName: 'office-building' as IconName, onClick: () => console.log('Very Long Label Text clicked') },
    { label: 'Clients', iconName: 'users' as IconName, onClick: () => console.log('Extremely Long Label clicked') },
    { label: 'Calendar', iconName: 'calendar' as IconName, onClick: () => console.log('Super Extra Long Label clicked') },
    { label: 'Reports', iconName: 'chart-bar' as IconName, onClick: () => console.log('Reports clicked') },
    { label: 'Settings', iconName: 'cog' as IconName, onClick: () => console.log('Settings clicked') },
  ],
};
LongLabels.parameters = {
  docs: {
    description: {
      story: 'This story demonstrates buttons with fixed 64x64px dimensions. Labels that are too long will wrap to two lines, and if still too long, will be truncated with ellipsis.',
    },
  },
};

const TemplateWithActiveInDrawer: Story<TecmaSidebarMobileProps> = () => {
  const [activeItem, setActiveItem] = useState<string>('Calendar'); // Calendar is in the drawer (4th item)
  const [simulateDesktopToMobile, setSimulateDesktopToMobile] = useState(false);

  const baseItems: TecmaSidebarMobileItem[] = [
    { label: 'Home', iconName: 'home' as IconName, onClick: () => console.log('Home clicked') },
    { label: 'Apartments', iconName: 'office-building' as IconName, onClick: () => console.log('Apartments clicked') },
    { label: 'Clients', iconName: 'users' as IconName, onClick: () => console.log('Clients clicked') },
    { label: 'Calendar', iconName: 'calendar' as IconName, onClick: () => console.log('Calendar clicked') },
    { label: 'Reports', iconName: 'chart-bar' as IconName, onClick: () => console.log('Reports clicked') },
    { 
      label: 'Sales', 
      iconName: 'chart-bar' as IconName, 
      onClick: () => console.log('Sales clicked'),
      subItems: [
        { label: 'Quotes', onClick: () => console.log('Quotes clicked') },
        { label: 'Proposals', onClick: () => console.log('Proposals clicked') },
        { label: 'Contracts', onClick: () => console.log('Contracts clicked') },
      ]
    },
    { label: 'Settings', iconName: 'cog' as IconName, onClick: () => console.log('Settings clicked') },
  ];

  // When simulating desktop to mobile, items should have isActive based on activeItem
  // This simulates the scenario where you navigate on desktop, then switch to mobile
  const items = useMemo(() => {
    if (simulateDesktopToMobile) {
      return baseItems.map((item) => ({
        ...item,
        isActive: item.label === activeItem || item.subItems?.some((sub) => sub.label === activeItem),
      }));
    }
    return baseItems.map((item) => ({
      ...item,
      isActive: item.label === activeItem,
      onClick: () => {
        setActiveItem(item.label);
        item.onClick();
      },
    }));
  }, [baseItems, activeItem, simulateDesktopToMobile]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: '20px', paddingBottom: '100px' }}>
        <h1>Content Area</h1>
        <p><strong>Active Item:</strong> {activeItem}</p>
        <p><strong>Simulating Desktop to Mobile:</strong> {simulateDesktopToMobile ? 'Yes' : 'No'}</p>
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            onClick={() => setSimulateDesktopToMobile(!simulateDesktopToMobile)}
            style={{ padding: '10px 20px', cursor: 'pointer' }}
          >
            {simulateDesktopToMobile ? 'Stop Simulating Desktop→Mobile' : 'Simulate Desktop→Mobile'}
          </button>
          <div style={{ marginTop: '10px' }}>
            <p><strong>Test Instructions:</strong></p>
            <ol style={{ marginLeft: '20px' }}>
              <li>Click "Simulate Desktop→Mobile" to simulate coming from desktop with "Calendar" active</li>
              <li>Observe that "More" button should be active (since Calendar is in the drawer)</li>
              <li>Click on different items to test normal behavior</li>
              <li>Click on "Calendar" (in drawer) to verify "More" stays active</li>
            </ol>
          </div>
        </div>
      </div>
      <TecmaSidebarMobile items={items} />
    </div>
  );
};

export const ActiveItemInDrawer = TemplateWithActiveInDrawer.bind({});
ActiveItemInDrawer.storyName = 'Active Item in Drawer (Desktop→Mobile Test)';
ActiveItemInDrawer.parameters = {
  docs: {
    description: {
      story: 'Questa story testa il comportamento quando un elemento nel drawer "More" è attivo (simulando il passaggio da desktop a mobile). Quando "Calendar" (4° elemento, nel drawer) è attivo, il pulsante "More" dovrebbe essere automaticamente attivo. Clicca "Simulate Desktop→Mobile" per testare questo scenario.',
    },
  },
};

const TemplateWithActiveSubItemInDrawer: Story<TecmaSidebarMobileProps> = () => {
  const [activeItem, setActiveItem] = useState<string>('Quotes'); // Quotes is a subItem of Sales (in drawer)
  const [simulateDesktopToMobile, setSimulateDesktopToMobile] = useState(false);

  const baseItems: TecmaSidebarMobileItem[] = [
    { label: 'Home', iconName: 'home' as IconName, onClick: () => console.log('Home clicked') },
    { label: 'Apartments', iconName: 'office-building' as IconName, onClick: () => console.log('Apartments clicked') },
    { label: 'Clients', iconName: 'users' as IconName, onClick: () => console.log('Clients clicked') },
    { label: 'Calendar', iconName: 'calendar' as IconName, onClick: () => console.log('Calendar clicked') },
    { 
      label: 'Sales', 
      iconName: 'chart-bar' as IconName, 
      onClick: () => console.log('Sales clicked'),
      subItems: [
        { label: 'Quotes', onClick: () => console.log('Quotes clicked') },
        { label: 'Proposals', onClick: () => console.log('Proposals clicked') },
        { label: 'Contracts', onClick: () => console.log('Contracts clicked') },
      ]
    },
    { label: 'Settings', iconName: 'cog' as IconName, onClick: () => console.log('Settings clicked') },
  ];

  const items = useMemo(() => {
    if (simulateDesktopToMobile) {
      return baseItems.map((item) => ({
        ...item,
        isActive: item.label === activeItem,
        subItems: item.subItems?.map((subItem) => ({
          ...subItem,
          isActive: subItem.label === activeItem,
        })),
      }));
    }
    return baseItems.map((item) => ({
      ...item,
      isActive: item.label === activeItem,
      subItems: item.subItems?.map((subItem) => ({
        ...subItem,
        isActive: subItem.label === activeItem,
        onClick: () => {
          setActiveItem(subItem.label);
          subItem.onClick();
        },
      })),
      onClick: () => {
        setActiveItem(item.label);
        item.onClick();
      },
    }));
  }, [baseItems, activeItem, simulateDesktopToMobile]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: '20px', paddingBottom: '100px' }}>
        <h1>Content Area</h1>
        <p><strong>Active Item:</strong> {activeItem}</p>
        <p><strong>Simulating Desktop to Mobile:</strong> {simulateDesktopToMobile ? 'Yes' : 'No'}</p>
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            onClick={() => setSimulateDesktopToMobile(!simulateDesktopToMobile)}
            style={{ padding: '10px 20px', cursor: 'pointer' }}
          >
            {simulateDesktopToMobile ? 'Stop Simulating Desktop→Mobile' : 'Simulate Desktop→Mobile'}
          </button>
          <div style={{ marginTop: '10px' }}>
            <p><strong>Test Instructions:</strong></p>
            <ol style={{ marginLeft: '20px' }}>
              <li>Click "Simulate Desktop→Mobile" to simulate coming from desktop with "Quotes" (subItem of Sales) active</li>
              <li>Observe that "More" button should be active (since Sales is in the drawer and has an active subItem)</li>
              <li>Open the drawer and verify that "Sales" shows the nested drawer with "Quotes" active</li>
            </ol>
          </div>
        </div>
      </div>
      <TecmaSidebarMobile items={items} />
    </div>
  );
};

export const ActiveSubItemInDrawer = TemplateWithActiveSubItemInDrawer.bind({});
ActiveSubItemInDrawer.storyName = 'Active SubItem in Drawer (Desktop→Mobile Test)';
ActiveSubItemInDrawer.parameters = {
  docs: {
    description: {
      story: 'Questa story testa il comportamento quando un subItem di un elemento nel drawer "More" è attivo. Quando "Quotes" (subItem di "Sales" che è nel drawer) è attivo, il pulsante "More" dovrebbe essere automaticamente attivo. Clicca "Simulate Desktop→Mobile" per testare questo scenario.',
    },
  },
};

export default {
  title: 'Components/TecmaSidebarMobile',
  component: TecmaSidebarMobile,
  parameters: {
    componentSubtitle: 'TecmaSidebarMobile component for mobile navigation.',
  },
  argTypes: {
    items: {
      description: 'Array of navigation items. Only the first 3 items will be visible in the sidebar. The 4th position will show a "More" button that opens the drawer. Items from the 5th position onwards will be shown in the drawer when "More" is clicked.',
      control: 'object',
    },
    className: {
      description: 'Additional CSS class name',
      control: 'text',
    },
  },
} as Meta<typeof TecmaSidebarMobile>;