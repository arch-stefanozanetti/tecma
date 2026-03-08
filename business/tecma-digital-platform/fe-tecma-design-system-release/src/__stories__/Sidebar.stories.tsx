import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { Button } from '../components/Button';
import { Sidebar, SidebarHeader } from '../components/Sidebar';
import { SidebarContent } from '../components/Sidebar/components/SidebarContent';
import { SidebarFooter } from '../components/Sidebar/components/SidebarFooter';
import { SidebarProps } from '../components/Sidebar/Sidebar';

interface TemplateInterface extends SidebarProps {
  showComponents?: boolean;
}
// 👇 We create a “template” of how args map to rendering
const Template: Story<TemplateInterface> = (args) => {
  const { isOpen, children } = args;
  const [isSidebarOpen, setIsSidebarOpen] = useState(isOpen || false);
  const handleOnToggle = () => setIsSidebarOpen(!isSidebarOpen);
  return (
    <div
      style={{
        width: '500px',
        height: '500px',
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        border: '1px dotted black',
      }}
    >
      <Button onClick={handleOnToggle}>Click me</Button>
      <Sidebar {...args} isOpen={isSidebarOpen} onBackdropClick={handleOnToggle} onToggle={handleOnToggle}>
        {children}
      </Sidebar>
    </div>
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
Basic.args = {
  children: [
    <Sidebar.Header headerIcon='home' toggleIconOnClose='expand' toggleIconOnOpen='contract' toggleLabel='menu' />,
    <Sidebar.Content
      itemsOnTop={[
        {
          icon: 'user',
          label: 'user',
          onClick: () => {
            console.log('USER!');
          },
        },
        {
          icon: 'home',
          label: 'home',
          onClick: () => {
            console.log('HOME!');
          },
        },
      ]}
      itemsOnBottom={[
        { icon: 'map', label: 'planimetry', onClick: () => console.log('map!') },
        {
          icon: 'office-building',
          label: 'buildings',
          onClick: () => console.log('office-building!'),
        },
      ]}
    />,
    <Sidebar.Footer iconName='information-circle'>
      <p>Footer!</p>
    </Sidebar.Footer>,
  ],
};
export const IsOpen = Template.bind({});
IsOpen.args = { isOpen: true, children: <div>custom content</div> };
export const Position = Template.bind({});
Position.args = { position: 'left' };
export const Width = Template.bind({});
Width.args = { width: 5 };
export const Height = Template.bind({});
Height.args = { height: 6 };
export const Type = Template.bind({});
Type.args = { type: 'offcanvas' };
export const OnBackdropClick = Template.bind({});
OnBackdropClick.args = {
  onBackdropClick: () => console.log('backdrop clicked!'),
};
export const OnToggle = Template.bind({});
OnToggle.args = { onToggle: () => console.log('toggle clicked!') };

export default {
  title: 'Components/Sidebar',
  component: Sidebar,
  parameters: {
    docs: {
      description: {
        component:
          '<em><strong>This is the old drawer component. No UX designer or frontend developer has properly worked on it. It will require a redesign once this component becomes mandatory.</strong></em>',
      },
    },
    componentSubtitle:
      'A panel which slides in from the edge of the screen. It accepts any kind of children or Sidebar.Header, Sidebar.Content and Sidebar.Footer components.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=57-3556',
    },
  },
  argTypes: {
    isOpen: {
      description: 'Defines whether the sidebar is open or closed',
      defaultValue: false,
    },
    position: {
      description: 'Defines the sidebar position',
      defaultValue: 'right',
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
    },
    width: {
      description: 'Defines the sidebar width in REM',
      defaultValue: null,
      control: 'number',
    },
    height: {
      description: 'Defines the sidebar height in REM',
      defaultValue: null,
      control: 'number',
    },
    type: {
      description: "Defines the sidebar's type",
      defaultValue: 'shrinkable',
      control: 'select',
      options: ['shrinkable', 'offcanvas'],
    },
    onBackdropClick: {
      description: 'Callback to perform on backdrop click',
      action: 'clicked',
    },
    onToggle: {
      description: 'The handler to be performed when clicking on the sidebar toggle',
      action: 'clicked',
    },
    children: {
      description: 'The Sidebar component can use both Sidebar.Header,Sidebar.Content, Sidebar.footer and any HTML element as child',
    },
  },
  subcomponents: { SidebarHeader, SidebarContent, SidebarFooter },
} as Meta<typeof Sidebar>;
