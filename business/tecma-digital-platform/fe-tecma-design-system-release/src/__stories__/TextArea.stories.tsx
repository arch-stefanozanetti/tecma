import React from 'react';

import { Story, Meta } from '@storybook/react';

import { TextArea } from '../components/TextArea';
import { TextAreaProps } from '../components/TextArea/TextArea';

// 👇 We create a “template” of how args map to rendering
const Template: Story<TextAreaProps> = (args) => <TextArea {...args} />;

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const Placeholder = Template.bind({});
Placeholder.args = { placeholder: 'hello' };
export const Maxlength = Template.bind({});
Maxlength.args = { maxlength: 100 };
export const Disabled = Template.bind({});
Disabled.args = { disabled: true };
export const Invalid = Template.bind({});
Invalid.args = { invalid: true };
export const Label = Template.bind({});
Label.args = { label: 'textarea label' };

export default {
  title: 'Components/TextArea',
  component: TextArea,
  parameters: {
    componentSubtitle: 'A form control for editing multi-line text.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=304-6871',
    },
  },
  argTypes: {
    label: {
      description: 'A label to show on top of textarea',
      defaultValue: '',
      control: 'text',
    },
    placeholder: {
      description: 'If defined, shows a placeholder into the textarea',
      defaultValue: 'hello',
      control: 'text',
    },
    maxlength: {
      description: 'Defines the max length for the textarea',
      defaultValue: undefined,
      control: 'text',
    },
    disabled: {
      description: 'If true, the textarea is disabled',
      defaultValue: false,
      control: 'boolean',
    },
    invalid: {
      description: 'If true, the textArea is invalid',
      defaultValue: false,
      control: 'boolean',
    },
  },
} as Meta<typeof TextArea>;
