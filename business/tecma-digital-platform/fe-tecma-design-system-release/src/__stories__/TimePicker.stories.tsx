import React from 'react';
import { Story, Meta } from '@storybook/react';
import { TimePickerProps, TimePicker } from '../components/TimePicker/TimePicker';

const Template: Story<TimePickerProps> = (args) => {
  const [time, setTime] = React.useState(new Date().toISOString());
  const handleTimeSave = (time: string) => {
    setTime(time);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTime(e.target.value);
  };
  return <TimePicker {...args} value={time} onChange={handleChange} onTimeSave={handleTimeSave} />;
};

export const Basic = Template.bind({});
Basic.args = {
  label: 'Start Time',
  placeholder: 'Select Start Time',
  required: false,
};
Basic.storyName = 'Basic Usage';

export default {
  title: 'Components/TimePicker',
  component: TimePicker,
  parameters: {
    componentSubtitle:
      'A customizable TimePicker component with manual input enabled for both hours (00–23) and minutes (00–59). Users can type in a valid time or select time values via a popover that displays hour and minute options.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=8006-34366&m=dev',
    },
  },
  argTypes: {
    className: {
      description: 'Optional CSS class to add to the TimePicker container.',
      defaultValue: '',
      control: 'text',
    },
    required: {
      description: 'Mark the time picker inputs as required.',
      defaultValue: false,
      control: 'boolean',
    },
    firstLabel: {
      description: "Label for the first time input (e.g. 'Start Time').",
      defaultValue: 'Start Time',
      control: 'text',
    },
    secondLabel: {
      description: "Label for the second time input (e.g. 'End Time').",
      defaultValue: 'End Time',
      control: 'text',
    },
    icon: {
      description: "Icon name to display at the left of each input (e.g. 'clock').",
      defaultValue: 'clock',
      control: 'text',
    },
  },
} as Meta<typeof TimePicker>;
