import React from 'react';

import { Story, Meta } from '@storybook/react';
import { DateTime } from 'luxon';

import { DatePicker } from '../components/DatePicker';
import { DatePickerProps } from '../components/DatePicker/DatePicker';

// Stories

export const Template: Story<DatePickerProps> = (args) => {
  return <DatePicker {...args} />;
};

export const PreselectedDates = Template.bind({});
PreselectedDates.decorators = [
  (StoryComponent) => (
    <div style={{ margin: '10rem auto' }}>
      <StoryComponent />
    </div>
  ),
];
PreselectedDates.storyName = 'Usage with default dates';
PreselectedDates.args = { value: DateTime.now() };

export default {
  title: 'Components/DatePicker',
  component: DatePicker,
  decorators: [
    (StoryComponent) => (
      <div style={{ margin: '10rem auto' }}>
        <StoryComponent />
      </div>
    ),
  ],
  parameters: {
    componentSubtitle: 'A date picker.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?type=design&node-id=709%3A6875&mode=design&t=z1xDJ5Wc1kTYP7Nn-1',
    },
  },
  argTypes: {
    localeLang: {
      description: 'The locale language for int dates',
      control: 'text',
    },
    label: {
      description: 'The label to show over the date picker',
      control: 'text',
    },
    mobileTitleLabel: {
      description: 'The title to show on the modal header in mobile view',
      control: 'text',
    },
    mobileSubTitleLabel: {
      description: 'The sub title to show on the modal header in mobile view',
      control: 'text',
    },
    dateFormat: {
      description:
        "We can set the date format by format. When format is an array, the input box can be entered in any of the valid formats of the array. For a complete list of formats, please refer to the luxon documentation, at 'Formatting' section",
      control: 'text',
    },
    status: {
      control: 'radio',
      description: 'The Date Picker status',
      options: ['success', 'error', 'warning', 'validating'],
    },
    allowClear: {
      control: 'boolean',
      description: 'If allow to clear fields',
    },
    loading: {
      control: 'boolean',
      description: 'Show spinner when pass loading to true',
    },
    placement: {
      control: 'radio',
      description:
        'You can manually specify the position of the popup via placement, when available, otherwise he take the available position',
      options: ['bottomLeft', 'bottomRight', 'topLeft', 'topRight'],
    },
    bordered: {
      control: 'radio',
      description: 'There are full, bottom and none, totally three variants to choose from.',
      options: ['full', 'bottom', 'none'],
    },
    direction: {
      control: 'radio',
      description:
        'How display the content. LTR languages display content from left to right. RTL languages display content from right to left',
      options: ['ltr', 'rtl'],
    },
  },
  args: {
    loading: false,
    placement: 'topLeft',
    bordered: 'full',
    localeLang: 'en-GB',
    direction: 'ltr',
    allowClear: 'true',
    mobileTitleLabel: 'Check-in',
    mobileSubTitleLabel: 'Minimum stay 6 months',
  },
} as Meta<typeof DatePicker>;
