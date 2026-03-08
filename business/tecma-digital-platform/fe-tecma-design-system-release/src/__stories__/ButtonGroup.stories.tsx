import React from 'react';

import { Story, Meta } from '@storybook/react';

import Button from '../components/Button/Button';
import ButtonGroup, { ButtonGroupProps } from '../components/ButtonGroup/ButtonGroup';

// 👇 We create a “template” of how args map to rendering
const Template: Story<ButtonGroupProps> = (args) => (
  <ButtonGroup {...args}>
    <Button onClick={() => undefined}>first</Button>
    <Button onClick={() => undefined}>second</Button>
    <Button onClick={() => undefined}>third</Button>
  </ButtonGroup>
);

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const Rounded = Template.bind({});
Rounded.args = { rounded: true };
export const Color = Template.bind({});
Color.args = { color: 'danger' };
export const Outlined = Template.bind({});
Outlined.args = { outlined: true };
export const Size = Template.bind({});
Size.args = { size: 'large' };
export const Link = Template.bind({});
Link.args = { link: true };

export const Fluid: Story<ButtonGroupProps> = (args) => (
  <div style={{ width: '500px', padding: '1rem', background: 'lightblue' }}>
    <ButtonGroup {...args}>
      <Button onClick={() => undefined}>first</Button>
      <Button onClick={() => undefined}>second</Button>
      <Button onClick={() => undefined}>third</Button>
    </ButtonGroup>
  </div>
);
Fluid.args = { fluid: true };

export const Orientation = Template.bind({});
Orientation.args = { orientation: 'vertical' };

export const Segmented = Template.bind({});
Segmented.args = { segmented: true };

export default {
  title: 'Components/ButtonGroup',
  component: ButtonGroup,
  subcomponents: { Button },
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=278-7983',
    },
  },
  argTypes: {
    rounded: {
      description: 'Makes the buttons rounded',
      defaultValue: false,
      control: 'boolean',
    },
    color: {
      description: "Defines the buttons' color, can be default, primary, secondary, info, warning, success, danger or transparent",
      defaultValue: 'primary',
      control: { type: 'radio' },
      options: ['primary', 'secondary', 'danger', 'inverse'],
    },
    outlined: {
      description: 'Shows the outlines only',
      defaultValue: false,
      control: 'boolean',
    },
    size: {
      description: "Defines the buttons' size, can be `small`, `medium`, `large`",
      defaultValue: 'medium',
      control: { type: 'radio' },
      options: ['small', 'medium', 'large'],
    },
    link: {
      description: 'If true, the button is similar to a link',
      defaultValue: false,
      control: 'boolean',
    },
    fluid: {
      description: "If true, the button is as wide as it's container",
      defaultValue: false,
      control: 'boolean',
    },
    orientation: {
      description: 'The buttons alignemnt',
      defaultValue: 'horizontal',
      control: { type: 'radio' },
      options: ['vertical', 'horizontal'],
    },
    segmented: {
      description: 'If true, the space between buttons has been removed',
      defaultValue: false,
      control: 'boolean',
    },
  },
} as Meta<typeof ButtonGroup>;
