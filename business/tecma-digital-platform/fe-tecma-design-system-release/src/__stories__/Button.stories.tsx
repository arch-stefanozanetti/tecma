import React from 'react';

import { Story, Meta } from '@storybook/react';

import Button, { ButtonProps } from '../components/Button/Button';
import { Colors as ColorsType } from '../declarations';
import { SizeStandard } from '../declarations/size';

// 👇 We create a “template” of how args map to rendering
const Template: Story<ButtonProps> = (args) => <Button {...args} />;

// Stories

export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export const OnClick = Template.bind({});
OnClick.args = {
  onClick: () => {
    console.log('CLICKED!!');
  },
  children: 'onClick',
};
OnClick.parameters = {
  docs: { description: { story: 'The function to perform on button click' } },
};

export const Disabled = Template.bind({});
Disabled.args = { disabled: true, children: 'disabled' };
Disabled.parameters = { docs: { description: { story: 'Disables the button' } } };

export const Rounded = Template.bind({});
Rounded.args = { rounded: true, children: 'rounded' };
Rounded.parameters = { docs: { description: { story: 'Makes the button rounded' } } };

export const Colors = () => {
  const colors = ['primary', 'secondary', 'danger', 'inverse'];
  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {colors.map((color) => (
        <Button onClick={() => undefined} color={color as ColorsType} key={color}>
          {color}
        </Button>
      ))}
    </div>
  );
};
Colors.parameters = {
  docs: {
    description: {
      story:
        "Defines the button color, can be primary, secondary, info, warning, success, danger or inverse. Inverse must be used for 'problematic background': the inverse button has ha white background color.",
    },
  },
};

export const Outlined = Template.bind({});
Outlined.args = { outlined: true, children: 'outlined' };
Outlined.parameters = { docs: { description: { story: 'Shows the outlines only' } } };

export const Sizes = () => {
  const sizes = ['small', 'medium', 'large'];
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'end' }}>
      {sizes.map((size) => (
        <Button onClick={() => undefined} size={size as SizeStandard} key={size}>
          {size}
        </Button>
      ))}
    </div>
  );
};

Sizes.parameters = {
  docs: { description: { story: "Defines the button's size, can be `small`, `medium`, `large`" } },
};

export const RightIcon = Template.bind({});
RightIcon.args = { rightIcon: true, children: 'rightIcon', iconName: 'user' };
RightIcon.parameters = {
  docs: {
    description: {
      story: 'If true, and iconName is defined, place the icon to the right of the text',
    },
  },
};

export const IconName = Template.bind({});
IconName.args = { iconName: 'user', children: '' };
IconName.parameters = { docs: { description: { story: 'The icon to show in the button' } } };

export const Loader = Template.bind({});
Loader.args = { loader: 'circle', children: '' };
IconName.parameters = { docs: { description: { story: 'The loader to show in the button' } } };

export const Fluid = () => (
  <div style={{ width: '500px', padding: '1rem', background: 'lightblue' }}>
    <Button fluid onClick={() => console.log('clicked!')}>
      click me
    </Button>
  </div>
);
Fluid.args = { fluid: true, children: 'fluid' };
Fluid.parameters = {
  docs: { description: { story: "If true, the button is as wide as it's container" } },
};

export const IconSize = () => {
  const sizes = ['small', 'medium', 'large'];
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'end' }}>
      {sizes.map((size) => (
        <Button onClick={() => undefined} size={size as SizeStandard} key={size} iconName='user' />
      ))}
    </div>
  );
};
IconSize.args = { children: '', iconName: 'user' };
IconSize.parameters = {
  docs: {
    description: {
      story: "Defines the icon's size, can be `small`, `medium`, `large`. If not provided, is equal to button size",
    },
  },
};

export const Link = Template.bind({});
Link.args = { link: true, children: 'link' };
Link.parameters = {
  docs: {
    description: {
      story: 'If true, the button is similar to a link',
    },
  },
};

export default {
  title: 'Components/Button',
  component: Button,
  parameters: {
    componentSubtitle:
      'A button is a clickable element used to perform an action. It contains a text label and a supporting icon can be displayed.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=0-1',
    },
  },
  argTypes: {
    onClick: {
      description: 'The function to perform on button click',
      defaultValue: () => console.log('CLICKED'),
      action: 'clicked',
    },
    disabled: {
      description: 'Disables the button',
      defaultValue: false,
      control: 'boolean',
    },
    rounded: {
      description: 'Makes the button rounded',
      defaultValue: false,
      control: 'boolean',
    },
    color: {
      description: 'Defines the button color, can be primary, secondary, info, warning, success, danger or inverse',
      defaultValue: 'primary',
      control: { type: 'radio' },
      options: ['primary', 'secondary', 'danger', 'inverse', 'transparent'],
    },
    outlined: {
      description: 'Shows the outlines only',
      defaultValue: false,
      control: 'boolean',
    },
    size: {
      description: "Defines the button's size, can be `small`, `medium`, `large`",
      defaultValue: 'medium',
      control: { type: 'radio' },
      options: ['small', 'medium', 'large'],
    },
    rightIcon: {
      description: 'If true, and iconName is defined, place the icon to the right of the text',
      defaultValue: false,
      control: 'boolean',
    },
    iconName: {
      description: 'The icon to show in the button',
      defaultValue: '',
      control: 'text',
    },
    loader: {
      description: 'The loader to show in the button',
      defaultValue: '',
      control: { type: 'radio' },
      options: ['circle', 'dotted', 'dotted-circle'],
    },
    fluid: {
      description: "If true, the button is as wide as it's container",
      defaultValue: false,
      control: 'boolean',
    },
    iconSize: {
      description: "Defines the icon's size, can be `small`, `medium`, `large`. If not provided, is equal to button size",
      defaultValue: undefined,
      control: { type: 'radio' },
      options: ['small', 'medium', 'large'],
    },
    link: {
      description: 'If true, the button is similar to a link',
      defaultValue: false,
      control: 'boolean',
    },
    children: {
      description: 'Element to show inside button',
      defaultValue: 'click me',
      control: { type: 'text' },
    },
  },
} as Meta<typeof Button>;
