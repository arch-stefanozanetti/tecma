import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { DropDown } from '../components/DropDown';
import { DropDownProps } from '../components/DropDown/DropDown';
import DropDownDivider from '../components/DropDown/DropDownDivider';
import DropDownItem from '../components/DropDown/DropDownItem';

// 👇 We create a “template” of how args map to rendering
const Template: Story<DropDownProps> = (args) => {
  const { isOpen, triggerProps } = args;
  const [isDropDownOpen, setIsDropDownOpen] = useState<boolean>(isOpen || false);
  return (
    <DropDown
      {...args}
      isOpen={isDropDownOpen}
      triggerProps={{
        ...triggerProps,
        onClick: () => setIsDropDownOpen(!isDropDownOpen),
        children: 'click',
      }}
      onToggle={() => setIsDropDownOpen(!isDropDownOpen)}
    >
      <DropDown.Item onClick={() => setIsDropDownOpen(!isDropDownOpen)}>Building 1</DropDown.Item>
      <DropDown.Item onClick={() => setIsDropDownOpen(!isDropDownOpen)}>Building 2</DropDown.Item>
      <DropDown.Divider />
      <DropDown.Item onClick={() => setIsDropDownOpen(!isDropDownOpen)}>Building 12345</DropDown.Item>
    </DropDown>
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export const TriggerProps = Template.bind({});
TriggerProps.args = {
  triggerProps: {
    color: 'danger',
    onClick: () => {
      console.log('clicked!');
    },
  },
  children: 'triggerProps',
};

export default {
  title: 'Components/DropDown',
  component: DropDown,
  parameters: {
    componentSubtitle:
      'A menu in which options are hidden by default but can be shown by interacting with a button. It accepts any kind of children or DropDown.Item and DropDown.Divider components.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=42-1595',
    },
  },
  argTypes: {
    isOpen: {
      description: 'If true, the dropdown is open',
      defaultValue: false,
      control: 'boolean',
    },
    onToggle: {
      description: 'The callback to perform on dropdown open',
      defaultValue: () => console.log('CLICKED'),
      action: 'clicked',
    },
    triggerProps: {
      description: 'The props for the dropdown trigger. As it is a Button, triggerProps match the Button props',
      defaultValue: {},
      control: 'object',
    },
    position: {
      description: 'The dropDown position',
      defaultValue: { vertical: 'bottom', horizontal: 'center' },
    },
    iconOnClose: {
      description: 'The icon to show on closed DropDown',
      defaultValue: 'arrow-down',
      control: 'text',
    },
    iconOnOpen: {
      description: 'The icon to show on open DropDown',
      defaultValue: 'arrow-up',
      control: 'text',
    },
    trigger: {
      description: 'If provided, it will replace the default trigger (Button) with anything else',
      defaultValue: undefined,
      control: 'text',
    },
    rotateIconOnToggle: {
      description: 'If true will be used only iconOnClose and it will rotate it on open',
      defaultValue: false,
      control: 'boolean',
    },
    subcomponents: { DropDownItem, DropDownDivider },
  },
} as Meta<typeof DropDown>;
