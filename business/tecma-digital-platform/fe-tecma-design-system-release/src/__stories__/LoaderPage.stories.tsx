import React from 'react';

import { Story, Meta } from '@storybook/react';

import { LoaderPage, LoaderPageProps } from '../components/LoaderPage';

export default {
  title: 'Common Pages/LoaderPage',
  component: LoaderPage,
} as Meta<typeof LoaderPage>;

const Template: Story<LoaderPageProps> = (args) => <LoaderPage {...args} />;

export const Default = Template.bind({});


