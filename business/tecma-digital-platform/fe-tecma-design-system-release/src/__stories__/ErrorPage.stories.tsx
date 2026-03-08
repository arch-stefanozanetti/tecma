import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { ErrorPage, ErrorPageProps } from '../components/ErrorPage';
import { LanguageSelector } from '../components/LanguageSelector';

const Template: Story<ErrorPageProps> = (args) => <ErrorPage {...args} />;
export const Default = Template.bind({});

export const DifferentLanguages = () => {
  const [language, setLanguage] = useState('en-GB');
  const handleOnChangeLanguage = (newLang: string) => {
    setLanguage(newLang);
  };
  return (
    <div>
      <LanguageSelector
        currentLanguage={language}
        onChangeLanguage={handleOnChangeLanguage}
        languages={['es-US', 'de-DE', 'en-US', 'en-GB', 'en-IN', 'es-ES']}
      />
      <ErrorPage language={language} />
    </div>
  );
};

export default {
  title: 'Common Pages/ErrorPage',
  component: ErrorPage,
  argTypes: {
    errorMsg: { control: 'text' },
    errorCause: {
      control: 'text',
    },
    errorSolution: {
      control: 'text',
      description: 'The error solution. Could be a `string`or a `ReactNode`.',
    },
    buttonLabel: { control: 'text' },
    buttonOnClick: { action: 'clicked' },
    logo: { control: 'text' },
    language: {
      control: 'select',
      options: ['es-US', 'de-DE', 'en-US', 'en-GB', 'en-IN', 'es-ES'],
      defaultValue: 'en-GB',
    },
  },
} as Meta<typeof ErrorPage>;
