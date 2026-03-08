import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { Radio } from '../components/Radio';
import RadioGroup, { RadioGroupProps } from '../components/RadioGroup/RadioGroup';

// 👇 We create a “template” of how args map to rendering
const Template: Story<RadioGroupProps> = ({ ...args }) => {
  const [cur, setCur] = useState<string | null>(null);

  const err = cur === 'pandoro';

  return (
    <RadioGroup
      row
      onChange={(_e, value) => {
        console.log('value', value);
        setCur(value);
      }}
      value={cur}
      helperText={err ? 'Errore' : undefined}
      {...args}
    >
      <Radio value='panettone' label='Panettone' />
      <Radio value='pandoro' label='Pandoro' color={err ? 'error' : undefined} />
    </RadioGroup>
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export const Label = Template.bind({});
Label.args = { label: 'radiogroup label' };
Label.storyName = 'Label Usage';

export default {
  title: 'Components/RadioGroup',
} as Meta<typeof RadioGroup>;
