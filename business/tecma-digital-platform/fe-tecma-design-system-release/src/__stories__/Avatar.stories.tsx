import React from 'react';

import { ComponentMeta, ComponentStory } from '@storybook/react';

import { Avatar } from '../components/Avatar';

export default {
  title: 'Components/Avatar',
  component: Avatar,
  parameters: {
    componentSubtitle: 'Avatars can be used to represent people or objects. It supports images, Icons, or letters.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=725-6732',
    },
  },
  argTypes: {
    size: {
      description: 'Defines the component size according to the Tecma design system.',
      control: 'radio',
      option: ['small', 'medium', 'large'],
      defaultValue: 'medium',
    },
    icon: {
      description: 'Accepts as input the name of a Tecma icon.',
      control: { type: 'select' },
      defaultValue: '',
    },
    text: {
      description: 'Accepts as input a string to add text to display inside component',
    },
    src: {
      description: 'Accepts as input a string to add the URL of an image.',
    },
    alt: {
      description: 'Alternatives text for html img tag. Default value is: tecma-avatar-alternative',
    },
    style: {
      description: 'Accepts as input an object and allows to add personalized style, such as background-color and text color.',
      defaultValue: {},
    },
    id: {
      defaultValue: '',
    },
    'data-testid': {
      control: 'text',
      defaultValue: 'tecma-avatar',
    },
  },
} as ComponentMeta<typeof Avatar>;

const divStyle = {
  backgroundColor: '#ffe189',
  color: '#ff9500',
};

export const Default: ComponentStory<typeof Avatar> = (args) => <Avatar {...args} />;

export const WithStyledText: ComponentStory<typeof Avatar> = (args) => <Avatar {...args} style={divStyle} text='SH' />;

export const WithIcon: ComponentStory<typeof Avatar> = (args) => <Avatar {...args} icon='user' />;

export const WithImg: ComponentStory<typeof Avatar> = (args) => <Avatar {...args} src='https://i.pravatar.cc/300' alt='ico' size='large' />;
