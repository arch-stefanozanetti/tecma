import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import Pagination, { PaginationProps } from '../components/Pagination/Pagination';

// 👇 We create a “template” of how args map to rendering
const Template: Story<PaginationProps> = (args) => {
  const { currentPage } = args;
  const [nextCurrentPage, setCurrentPage] = useState<number>(currentPage || 1);

  const handleCurrentPage = (page: number) => setCurrentPage(page);
  const handleNextPage = () => setCurrentPage(nextCurrentPage + 1);
  const handlePrevPage = () => setCurrentPage(nextCurrentPage - 1);
  return (
    <Pagination
      {...args}
      currentPage={nextCurrentPage}
      setCurrentPage={handleCurrentPage}
      setNextPage={handleNextPage}
      setPrevPage={handlePrevPage}
    />
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const Disabled = Template.bind({});
Disabled.args = { disabled: true };
export const PagesToShowCloseTheCurrent = Template.bind({});
PagesToShowCloseTheCurrent.args = { pagesToShowCloseTheCurrent: 3 };

export default {
  title: 'Components/Pagination',
  component: Pagination,
  parameters: {
    componentSubtitle: 'Pagination is the process of splitting information over multiple pages instead of showing it all on a single page.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=58-5173',
    },
  },
  argTypes: {
    pages: {
      description: 'The number of pages to show',
      defaultValue: 10,
      control: 'number',
    },
    currentPage: {
      description: 'The current page',
      defaultValue: 6,
      control: { type: 'select' },
      options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    setCurrentPage: {
      description: 'Defines the callback to perform on page click',
    },
    disabled: {
      description: 'Defines if the pagination is disabled',
      defaultValue: false,
      control: 'boolean',
    },
    pagesToShowCloseTheCurrent: {
      description: 'Defines how many pages to show close to the current page',
      defaultValue: 1,
      control: 'number',
    },
  },
} as Meta<typeof Pagination>;
