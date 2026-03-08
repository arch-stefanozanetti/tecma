import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { SearchBar } from '../components/SearchBar';
import { SearchBarProps } from '../components/SearchBar/SearchBar';

// 👇 We create a “template” of how args map to rendering
const Template: Story<SearchBarProps> = (args) => {
  const [isLoading, setIsLoading] = useState(false);
  const onSubmit = (formData: string) => {
    console.log('formData: ', formData);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };
  const onCancel = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };
  return (
    <SearchBar
      {...args}
      onSearch={onSubmit}
      onCancel={onCancel}
      options={{
        maxLength: { value: 4, message: 'MaxLength err msg' },
      }}
      label='Search label'
      isLoading={isLoading}
    />
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export default {
  title: 'Components/SearchBar',
  component: SearchBar,
  parameters: {
    componentSubtitle: 'SearchBar composed of Input and Button components, uses the useFormHandler() hook.',
    design: {
      type: 'figma',
      url: '',
    },
  },
  argTypes: {
    onSearch: {
      description: 'The submit function, receives as prop the search query. Triggers onSubmit and on submit button click.',
      control: 'object',
    },
    onCancel: {
      description: 'The cancel function, receives as prop the searchText. Triggers only on cancel button click.',
      control: 'object',
    },
    placeholder: {
      description: 'The input label',
      defaultValue: 'Search by name, phone or email...',
      control: 'text',
    },
    label: {
      description: 'The searchbar input label',
      defaultValue: 'Start your search',
      control: 'text',
    },
    defaultValue: {
      description: 'The initial/default value',
      control: 'text',
    },
    searchButtonText: {
      description: 'Submit button label',
      defaultValue: 'Search',
      control: 'text',
    },
    cancelButtonText: {
      description: 'Cancel button label',
      defaultValue: 'Cancel',
      control: 'text',
    },
    options: {
      description: `Search validation options. 
                    \nExample: { maxLength: { value: 4, message: "MaxLength err msg" }}`,
      defaultValue: undefined,
      control: 'object',
    },
    isLoading: {
      description: 'When true displays spinner in submit button',
      defaultValue: false,
      control: 'boolean',
    },
    disabled: {
      defaultValue: false,
      control: 'boolean',
    },
  },
} as Meta<typeof SearchBar>;
