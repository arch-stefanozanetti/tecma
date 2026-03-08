import React from 'react';

import { Story, Meta } from '@storybook/react';
import { DateTime } from 'luxon';

import DateRangePicker, { DateRangePickerProps } from '../components/DateRangePicker/DateRangePicker';

// Stories

export const Template: Story<DateRangePickerProps> = (args) => {
  return (
    <DateRangePicker
      {...args}
      // @ts-ignore
      value={['', '']}
    />
  );
};

const MultiTemplate: Story<DateRangePickerProps> = (args) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <DateRangePicker {...args} format='DD/MM/YYYY' />
      <DateRangePicker {...args} format='MM.DD.YYYY' />
      <DateRangePicker {...args} format='DD MMM YYYY' />
    </div>
  );
};

export const MinDays = Template.bind({});
MinDays.decorators = [
  (StoryComponent) => (
    <div style={{ margin: '10rem auto' }}>
      <StoryComponent />
    </div>
  ),
];
MinDays.storyName = 'Usage with min 30 days from check-in';
MinDays.args = { minimumDays: 60 };

export const PreselectedDates = Template.bind({});
PreselectedDates.decorators = [
  (StoryComponent) => (
    <div style={{ margin: '10rem auto' }}>
      <StoryComponent />
    </div>
  ),
];
PreselectedDates.storyName = 'Usage with default dates';
PreselectedDates.args = { value: [DateTime.now().minus({ days: 30 }), DateTime.now()] };

export const DateFormat = MultiTemplate.bind({});
DateFormat.decorators = [
  (StoryComponent) => (
    <div style={{ margin: '10rem auto' }}>
      <StoryComponent />
    </div>
  ),
];
DateFormat.storyName = 'DateFormat';
DateFormat.args = {
  value: [DateTime.now().minus({ days: 30 }), DateTime.now()],
};

export default {
  title: 'Components/DateRangePicker',
  component: DateRangePicker,
  decorators: [
    (StoryComponent) => (
      <div style={{ margin: '10rem auto' }}>
        <StoryComponent />
      </div>
    ),
  ],
  parameters: {
    componentSubtitle: 'A date range picker.',
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
      description: 'The label to show over the range date picker',
      control: 'text',
    },
    minimumDays: {
      description: 'The minimum days from check-in and check-out in mobile view',
      control: 'number',
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
      description: 'The Date Range Picker status',
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
    mobileTitleLabel: 'Check-in/Check-out',
    mobileSubTitleLabel: 'Minimum stay 6 months',
  },
} as Meta<typeof DateRangePicker>;
