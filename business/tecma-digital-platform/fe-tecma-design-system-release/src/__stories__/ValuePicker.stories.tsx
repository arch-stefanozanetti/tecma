import React, { useState } from 'react';

import { ComponentStory, ComponentMeta } from '@storybook/react';

import { ValuePicker } from '../components/ValuePicker';

const stringOptions = [
  { value: 'bilo', label: 'Bilocale' },
  { value: 'trilo', label: 'Trilocale' },
  { value: 'quadri', label: 'Quadrilocale' },
];
const numberOptions = [1, 2, 3, 4, 5, 6].map((el) => ({ value: el, label: `${el}° piano` }));

export const BasicUsage: ComponentStory<typeof ValuePicker> = (args) => {
  const [value, setValue] = useState<string>(stringOptions[0].value);

  return <ValuePicker<string> {...args} options={stringOptions} value={value} onChange={(newValue) => setValue(newValue)} />;
};

export const WithLoop: ComponentStory<typeof ValuePicker> = (args) => {
  const [value, setValue] = useState<string>(stringOptions[0].value);

  return <ValuePicker<string> {...args} options={stringOptions} value={value} onChange={(newValue) => setValue(newValue)} loop />;
};

export const ValuePickerWithNumber: ComponentStory<typeof ValuePicker> = (args) => {
  const [value, setValue] = useState<number>(numberOptions[0].value);

  return <ValuePicker<number> {...args} options={numberOptions} value={value} onChange={(newValue) => setValue(newValue)} />;
};

export const OtherIcon: ComponentStory<typeof ValuePicker> = (args) => {
  const [value, setValue] = useState<string>(stringOptions[0].value);

  return (
    <ValuePicker<string>
      {...args}
      options={stringOptions}
      value={value}
      onChange={(newValue) => setValue(newValue)}
      leftIcon='heart'
      rightIcon='home'
    />
  );
};

export const ValuePickerOutlined: ComponentStory<typeof ValuePicker> = (args) => {
  const [value, setValue] = useState<string>(stringOptions[0].value);

  return <ValuePicker<string> {...args} options={stringOptions} value={value} onChange={(newValue) => setValue(newValue)} outlined />;
};

export const WithPlaceholder: ComponentStory<typeof ValuePicker> = (args) => {
  const [value, setValue] = useState<string | null>(null);

  return (
    <ValuePicker<string>
      {...args}
      options={stringOptions}
      value={value}
      onChange={(newValue) => setValue(newValue)}
      placeholder='Choose from 4 models'
    />
  );
};

export default {
  title: 'Components/ValuePicker',
  component: ValuePicker,
  argTypes: {
    rightIcon: {
      description: 'The icon to show on the right side',
      defaultValue: 'arrow-right',
      control: 'text',
    },
    leftIcon: {
      description: 'The icon to show on the left side',
      defaultValue: 'arrow-left',
      control: 'text',
    },
    prevOnClick: {
      description: 'The function to perform on left button click',
    },
    leftOnClick: { description: 'The function to perform on right button click' },
    options: {
      description: 'An array of value to be shown one by one',
      defaultValue: stringOptions,
    },
    outlined: { description: 'If true show an outlined component', defaultValue: false },
  },
} as ComponentMeta<typeof ValuePicker>;
