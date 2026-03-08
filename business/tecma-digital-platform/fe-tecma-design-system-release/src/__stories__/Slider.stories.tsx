import React from 'react';

import { Story, Meta } from '@storybook/react';

import Slider, { SliderProps } from '../components/Slider/Slider';

// 👇 We create a “template” of how args map to rendering
const Template: Story<SliderProps> = (args) => (
  <div
    style={{
      width: '100px',
      height: '100px',
      display: 'flex',
      alignItems: 'center',
      padding: '1rem',
    }}
  >
    <Slider {...args} />
  </div>
);

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const Label = Template.bind({});
Label.storyName = 'Label Usage';
Label.args = { label: 'slider Label' };
export const HelpText = Template.bind({});
HelpText.args = { helpText: 'hello' };
export const HelpTextErrored = Template.bind({});
HelpTextErrored.args = { helpText: 'hello', error: true };

export default {
  title: 'Components/Slider',
  component: Slider,
  parameters: {
    componentSubtitle: 'A form control for choosing a value within a preset range of values.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=309-6843',
    },
  },
  argTypes: {
    value: {
      description: 'A number used to set the slider pointer position',
      defaultValue: 0,
      control: 'number',
    },
    onMouseDown: {
      description: 'A callback to perform on mouseDown',
      defaultValue: undefined,
      action: 'clicked',
    },
    onMouseUp: {
      description: 'A callback to perform on mouseUp',
      defaultValue: undefined,
      action: 'clicked',
    },
    disabled: {
      description: 'If true, the slider is disabled',
      default: false,
      control: 'boolean',
    },
    label: {
      description: 'A label to show on top of the slider',
      defaultValue: '',
      control: 'text',
    },
    helpText: {
      description: 'The text to show as help',
      defaultValue: '',
      control: 'text',
    },
  },
} as Meta<typeof Slider>;
