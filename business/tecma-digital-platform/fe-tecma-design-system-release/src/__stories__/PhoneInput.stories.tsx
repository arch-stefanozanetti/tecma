import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { PhoneInput } from '../components/PhoneInput';
import { PhoneInputProps } from '../components/PhoneInput/PhoneInput';
import { getCountryAndPrefix, isValidNumber, PhoneCountry } from '../helpers/phone-input';
import { OptionSelect } from '../components/Select/Select';

// 👇 We create a “template” of how args map to rendering
const Template: Story<PhoneInputProps> = (args) => {
  const [value, setValue] = useState('');
  const [defaultCountry, setDefaultCountry] = useState<OptionSelect>(getCountryAndPrefix('IT', 'en'));

  const handleSelectChange = (newValue: OptionSelect | OptionSelect[]) => {
    setDefaultCountry(newValue as OptionSelect);
  };
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setValue(e?.target?.value);
  };

  return (
    <div style={{ minHeight: 400 }}>
      <PhoneInput {...args} onChange={handleChange} value={value} selectedCountry={defaultCountry} onChangeCountry={handleSelectChange} />
    </div>
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const CurrentLanguage = Template.bind({});
CurrentLanguage.args = { currentLanguage: 'de' };
export const Placeholder = Template.bind({});
Placeholder.args = { placeholder: 'Hello there!!' };
export const Label = Template.bind({});
Label.args = { label: 'Insert phone number' };

export const IsValidPhoneNumber = (args) => {
  const [value, setValue] = useState('');
  const [defaultCountry, setDefaultCountry] = useState<OptionSelect>(getCountryAndPrefix('IT', 'en'));

  const handleSelectChange = (newValue: OptionSelect | OptionSelect[]) => {
    setDefaultCountry(newValue as OptionSelect);
  };
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setValue(e?.target?.value);
  };

  const isValid = isValidNumber(defaultCountry.value as PhoneCountry, value);
  return (
    <PhoneInput
      {...args}
      onChange={handleChange}
      value={value}
      selectedCountry={defaultCountry}
      onChangeCountry={handleSelectChange}
      status={isValid ? '' : 'error'}
      helpText={isValid ? '' : 'error'}
    />
  );
};

export default {
  title: 'Components/PhoneInput',
  component: PhoneInput,
  parameters: {
    componentSubtitle: (
      <>
        <p>A phone input type. This component exposes different utilityies:</p>
        <ul>
          <li>
            <strong>getCountryAndPrefix</strong> allow to select the correct country in the correct language. This function is not mandatory
            to use, but is useful to select the Select component first value from the its countries array. It is to avoid to write
            somenthing like&nbsp;
            <em
              style={{
                backgroundColor: '#F8F8F8',
                border: '1px solid #EEEEEE',
                borderRadius: '3px',
                padding: '2px 0',
              }}
            >
              const [defaultCountry, setDefaultCountry] = useState( &#123;label: &quot;Italy +39&quot;, value: &quot;IT&quot;&#125;),
            </em>
          </li>
          <li>
            <strong>isValidNumber</strong> which check the validity of the phone number
          </li>
        </ul>
      </>
    ),
    design: {
      type: 'figma',
      url: '',
    },
  },
  argTypes: {
    currentLanguage: {
      description: 'current language',
      defaultValue: 'en',
      control: { type: 'select' },
      options: ['en', 'it', 'es', 'fr', 'de'],
    },
    placeholder: {
      description: 'The placeholder to show into the input',
      defaultValue: 'Enter phone number',
      control: 'text',
    },
    label: {
      description: 'The select label',
      defaultValue: 'Phone number',
      control: 'text',
    },
    onChangeCountry: {
      description: 'The callback to perform on select change',
    },
  },
} as Meta<typeof PhoneInput>;
