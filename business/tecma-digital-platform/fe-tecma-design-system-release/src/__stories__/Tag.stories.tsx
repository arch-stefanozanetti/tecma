import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { Tag } from '../components/Tag';
import { TagProps } from '../components/Tag/Tag';

const tags = ['tag 1', 'tag 2', 'tag 3'];
// 👇 We create a “template” of how args map to rendering
const Template: Story<TagProps> = (args) => (
  <div style={{ display: 'flex', gap: '10px' }}>
    {tags.map((tag) => (
      <Tag {...args} label={tag} key={tag} />
    ))}
  </div>
);

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const OnDismissableIconClick: Story<TagProps> = () => {
  const [nextTags, setNextTags] = useState<Array<string>>(tags);
  const removeTag = (value: string) => {
    setNextTags(nextTags.filter((tag) => tag !== value));
  };
  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      {nextTags.map((tag) => (
        <Tag label={tag} dismissable onDismissableIconClick={() => removeTag(tag)} key={tag} />
      ))}
    </div>
  );
};
OnDismissableIconClick.args = {
  onDismissableIconClick: () => {
    console.log('are you sure you want to remove the tag?');
  },
  dismissable: true,
};
OnDismissableIconClick.parameters = {
  docs: { description: { story: 'It allows to add some action to do when removing the tag' } },
};
export const Disabled = Template.bind({});
Disabled.args = { disabled: true };

export default {
  title: 'Components/Tag',
  component: Tag,
  parameters: {
    componentSubtitle:
      'A small label, generally appearing inside or in close proximity to another larger interface component, representing a status, property, or some other metadata.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=245-5206',
    },
  },
  argTypes: {
    label: {
      description: 'The tag label',
      defaultValue: 'hello',
      control: 'text',
    },
    iconName: {
      description: 'The tag icon',
      defaultValue: 'user',
      control: 'text',
    },
    dismissableIcon: {
      description: 'The close icon',
      defaultValue: 'x',
      control: 'text',
    },
    onDismissableIconClick: {
      description: 'The action to perform on close icon click',
      defaultValue: undefined,
      action: 'clicked',
    },
    dismissable: {
      description: 'If true, the tag is dismissable',
      defaultValue: false,
      control: 'boolean',
    },
    disabled: {
      description: 'If true, the tag is disabled',
      defaultValue: false,
      control: 'boolean',
    },
  },
} as Meta<typeof Tag>;
