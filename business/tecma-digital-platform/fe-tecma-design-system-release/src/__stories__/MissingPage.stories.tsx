import React from 'react';

import { Story, Meta } from '@storybook/react';

import { MissingPage, MissingPageProps } from '../components/MissingPage';

export default {
  title: 'Common Pages/MissingPage',
  component: MissingPage,
} as Meta<typeof MissingPage>;

const Template: Story<MissingPageProps> = (args) => <MissingPage {...args} />;

export const Default = Template.bind({});
