import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

// eslint-disable-next-line import/no-named-as-default
import LanguageSelector, { LanguageSelectorProps } from '../components/LanguageSelector/LanguageSelector';

// Stories

export const Template: Story<LanguageSelectorProps> = (args) => {
  const { currentLanguage } = args;
  const [language, setLanguage] = useState(currentLanguage);

  const handleOnChangeLanguage = (newLang: string) => {
    setLanguage(newLang);
  };

  return (
    <LanguageSelector
      {...args}
      currentLanguage={language}
      onChangeLanguage={handleOnChangeLanguage}
      position={{ vertical: 'top', horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    />
  );
};

Template.storyName = 'Basic Usage';

// Storie
export const Rotated: Story<LanguageSelectorProps> = () => {
  const [language, setLanguage] = useState('it-IT');
  const handleOnChangeLanguage = (newLang: string) => {
    setLanguage(newLang);
  };
  return <LanguageSelector currentLanguage={language} rotated onChangeLanguage={handleOnChangeLanguage} />;
};

Rotated.decorators = [
  (StoryComponent) => (
    <div style={{ margin: '10rem', transform: 'rotate(180deg)' }}>
      <StoryComponent />
    </div>
  ),
];
Rotated.parameters = {
  docs: {
    description: {
      story: 'Support screen rotation, rotating the menu list',
    },
  },
};

export const Transparent: Story<LanguageSelectorProps> = () => {
  const [language, setLanguage] = useState('it-IT');
  const handleOnChangeLanguage = (newLang: string) => {
    setLanguage(newLang);
  };
  return <LanguageSelector currentLanguage={language} transparent onChangeLanguage={handleOnChangeLanguage} />;
};

Transparent.decorators = [
  (StoryComponent) => (
    <div style={{ padding: '10rem', background: '#000' }}>
      <StoryComponent />
    </div>
  ),
];
Transparent.parameters = {
  docs: {
    description: {
      story: 'Support screen rotation, rotating the menu list',
    },
  },
};

export const Position: Story<LanguageSelectorProps> = (args) => {
  const { currentLanguage } = args;
  const [language, setLanguage] = useState(currentLanguage);

  const handleOnChangeLanguage = (newLang: string) => {
    setLanguage(newLang);
  };

  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <LanguageSelector
        {...args}
        currentLanguage={language}
        onChangeLanguage={handleOnChangeLanguage}
        position={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        languages={['it-IT', 'en-GB', 'de-DE', 'fr-FR', 'es-ES']}
      />

      <LanguageSelector
        {...args}
        currentLanguage={language}
        onChangeLanguage={handleOnChangeLanguage}
        position={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        languages={['it-IT', 'en-GB', 'de-DE', 'fr-FR', 'es-ES']}
      />
      <div style={{ display: 'flex', gap: '1rem', transform: 'rotate(180deg)' }}>
        <LanguageSelector
          {...args}
          currentLanguage={language}
          onChangeLanguage={handleOnChangeLanguage}
          rotated
          position={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          languages={['it-IT', 'en-GB', 'de-DE', 'fr-FR', 'es-ES']}
        />
        <LanguageSelector
          {...args}
          currentLanguage={language}
          onChangeLanguage={handleOnChangeLanguage}
          rotated
          position={{ vertical: 'bottom', horizontal: 'center' }}
          transformOrigin={{ vertical: 'top', horizontal: 'center' }}
          languages={['it-IT', 'en-GB', 'de-DE', 'fr-FR', 'es-ES']}
        />
      </div>
    </div>
  );
};

export default {
  title: 'Components/LanguageSelector',
  component: LanguageSelector,
  decorators: [
    (StoryComponent) => (
      <div style={{ margin: '10rem' }}>
        <StoryComponent />
      </div>
    ),
  ],
  parameters: {
    componentSubtitle: 'A Language selector.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?type=design&node-id=2363-8538&mode=design',
    },
  },
  argTypes: {
    currentLanguage: {
      description: 'The locale language for int dates',
      control: 'text',
    },
    transparent: {
      control: 'boolean',
      description: 'Set if show button transparent or not',
    },
    rotated: {
      control: 'boolean',
      description: 'Rotate if need',
    },
    languages: {
      control: 'array',
      description: 'Array of languages supported by the project',
    },
    position: {
      control: 'radio',
      description: 'Set where language selector is positioned in the screen',
    },
    onChangeLanguage: {
      action: true,
    },
  },
  args: {
    languages: ['it-IT', 'en-GB', 'en-US', 'en-IN', 'de-DE', 'fr-FR', 'es-ES', 'es-US'],
    currentLanguage: 'en-GB',
    transparent: false,
    rotated: false,
  },
} as Meta<typeof LanguageSelector>;
