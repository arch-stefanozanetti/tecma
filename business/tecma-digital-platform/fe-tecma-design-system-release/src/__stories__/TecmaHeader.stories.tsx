import React from 'react';
import { Story, Meta } from '@storybook/react';
import TecmaHeader, { TecmaHeaderProps, DropdownItem, UserDropdownProps, TecmaHeaderTexts, HeaderAction } from '../components/TecmaHeader/TecmaHeader';

const Template: Story<TecmaHeaderProps> = (args) => (
  <div style={{ height: '100vh', paddingTop: '80px' }}>
    <TecmaHeader {...args} />
    <div style={{ padding: '20px' }}>
      <h1>Main Content Area</h1>
      <p>This is where the main content would go when using the TecmaHeader component.</p>
      <p>The header is positioned fixed at the top of the page.</p>
    </div>
  </div>
);

export const Default = Template.bind({});
Default.storyName = 'Default (Settings dropdown + User dropdown)';
Default.args = {
  labelUserLogged: 'Mario Rossi',
  headerActions: [
    {
      id: 'support-action',
      label: 'Support',
      iconName: 'headset',
      ariaLabel: 'Support',
      onClick: () => console.log('Support clicked'),
      isVisible: true,
    } as HeaderAction,
  ],
  settingsDropdownItems: [
    { isVisible: true, iconName: 'cog', label: 'Preferences', onClick: () => console.log('Preferences') } as DropdownItem,
    { isVisible: true, iconName: 'bell', label: 'Notifications', onClick: () => console.log('Notifications') } as DropdownItem,
  ],
  userDropdown: {
    userLogged: 'Vendor manager',
    phone: '3343304569',
    email: 'm.rossi@email.com',
    useOTP: true,
    otpLabel: 'OTP',
    otpSubLabel: 'Not active',
    onOtpClick: () => console.log('OTP clicked'),
    languages: [
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom', selected: true },
      { value: 'en-US', label: 'English', subLabel: 'United States' },
      { value: 'es-ES', label: 'Español', subLabel: 'España' },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia' },
    ],
    onLanguageSelect: (v: string) => console.log('Language selected:', v),
    resourcesLabel: 'Resources',
    onResourcesClick: () => console.log('Resources clicked'),
    newsletterLabel: 'Newsletter',
    onNewsletterClick: () => console.log('Newsletter clicked'),
    logoutLabel: 'Logout',
    onLogout: () => console.log('Logout'),
  } as UserDropdownProps,
  texts: {
    settingsLabel: 'Settings',
    backLabel: 'Back',
    languageLabel: 'Language',
  } as TecmaHeaderTexts,
};

export const WithSupportAction = Template.bind({});
WithSupportAction.storyName = 'With Support Header Action';
WithSupportAction.args = {
  ...Default.args,
  headerActions: [
    {
      id: 'support-action',
      label: 'Support',
      iconName: 'headset',
      ariaLabel: 'Support',
      onClick: () => console.log('Support clicked'),
      isVisible: true,
    } as HeaderAction,
  ],
};

export const WithCustomClassName = Template.bind({});
WithCustomClassName.storyName = 'With Custom Class Name';
WithCustomClassName.args = {
  className: 'custom-header',
  labelUserLogged: 'John Doe',
  settingsDropdownItems: [
    { isVisible: true, iconName: 'cog', label: 'Preferences', onClick: () => console.log('Preferences') } as DropdownItem,
    { isVisible: true, iconName: 'bell', label: 'Notifications', onClick: () => console.log('Notifications') } as DropdownItem,
  ],
  userDropdown: {
    userLogged: 'Vendor manager',
    phone: '3343304569',
    email: 'john.doe@email.com',
    useOTP: true,
    otpLabel: 'OTP',
    otpSubLabel: 'Not active',
    onOtpClick: () => console.log('OTP clicked'),
    languages: [
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom', selected: true },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia' },
    ],
    onLanguageSelect: (v: string) => console.log('Language selected:', v),
    resourcesLabel: 'Resources',
    onResourcesClick: () => console.log('Resources clicked'),
    newsletterLabel: 'Newsletter',
    onNewsletterClick: () => console.log('Newsletter clicked'),
    logoutLabel: 'Logout',
    onLogout: () => console.log('Logout'),
  },
  texts: {
    settingsLabel: 'Settings',
    backLabel: 'Back',
    languageLabel: 'Language',
  } as TecmaHeaderTexts,
};

export const LanguageSelection = Template.bind({});
LanguageSelection.storyName = 'Language Selection Demo';
LanguageSelection.args = {
  labelUserLogged: 'Language Tester',
  settingsDropdownItems: [
    { isVisible: true, iconName: 'cog', label: 'Preferences', onClick: () => console.log('Preferences') } as DropdownItem,
  ],
  userDropdown: {
    userLogged: 'Language Manager',
    phone: '3343304569',
    email: 'language.tester@email.com',
    useOTP: true,
    otpLabel: 'OTP',
    otpSubLabel: 'Active',
    onOtpClick: () => console.log('OTP clicked'),
    languages: [
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom', selected: true },
      { value: 'en-US', label: 'English', subLabel: 'United States' },
      { value: 'es-ES', label: 'Español', subLabel: 'España' },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia' },
      { value: 'fr-FR', label: 'Français', subLabel: 'France' },
      { value: 'de-DE', label: 'Deutsch', subLabel: 'Deutschland' },
    ],
    onLanguageSelect: (value: string) => {
      console.log('Language selected:', value);
      // In a real app, this would update the application language
    },
    resourcesLabel: 'Resources',
    onResourcesClick: () => console.log('Resources clicked'),
    newsletterLabel: 'Newsletter',
    onNewsletterClick: () => console.log('Newsletter clicked'),
    logoutLabel: 'Logout',
    onLogout: () => console.log('Logout'),
  } as UserDropdownProps,
  texts: {
    settingsLabel: 'Settings',
    backLabel: 'Back',
    languageLabel: 'Language',
  } as TecmaHeaderTexts,
};

export const WithPreSelectedLanguage = Template.bind({});
WithPreSelectedLanguage.storyName = 'With Pre-selected Language from API';
WithPreSelectedLanguage.args = {
  labelUserLogged: 'API User',
  selectedLanguage: 'it-IT', // Simulating language from API
  settingsDropdownItems: [
    { isVisible: true, iconName: 'cog', label: 'Preferences', onClick: () => console.log('Preferences') } as DropdownItem,
  ],
  userDropdown: {
    userLogged: 'API Manager',
    phone: '3343304569',
    email: 'api.user@email.com',
    useOTP: true,
    otpLabel: 'OTP',
    otpSubLabel: 'Active',
    onOtpClick: () => console.log('OTP clicked'),
    languages: [
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom' },
      { value: 'en-US', label: 'English', subLabel: 'United States' },
      { value: 'es-ES', label: 'Español', subLabel: 'España' },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia', selected: true },
      { value: 'fr-FR', label: 'Français', subLabel: 'France' },
    ],
    onLanguageSelect: (value: string) => {
      console.log('Language selected from API context:', value);
      // In a real app, this would call an API to update the user's language preference
    },
    resourcesLabel: 'Resources',
    onResourcesClick: () => console.log('Resources clicked'),
    newsletterLabel: 'Newsletter',
    onNewsletterClick: () => console.log('Newsletter clicked'),
    logoutLabel: 'Logout',
    onLogout: () => console.log('Logout'),
  } as UserDropdownProps,
  texts: {
    settingsLabel: 'Settings',
    backLabel: 'Back',
    languageLabel: 'Language',
  } as TecmaHeaderTexts,
};

export const CopyToClipboardDemo = Template.bind({});
CopyToClipboardDemo.storyName = 'Copy to Clipboard Demo';
CopyToClipboardDemo.args = {
  labelUserLogged: 'Copy Tester',
  settingsDropdownItems: [
    { isVisible: true, iconName: 'cog', label: 'Preferences', onClick: () => console.log('Preferences') } as DropdownItem,
  ],
  userDropdown: {
    userLogged: 'Copy Manager',
    phone: '+39 334 330 4569',
    email: 'copy.tester@example.com',
    useOTP: false, // Disabled to focus on copy functionality
    otpLabel: 'OTP',
    otpSubLabel: 'Disabled',
    onOtpClick: () => console.log('OTP clicked'),
    languages: [
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom', selected: true },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia' },
    ],
    onLanguageSelect: (value: string) => {
      console.log('Language selected:', value);
    },
    resourcesLabel: 'Resources',
    onResourcesClick: () => console.log('Resources clicked'),
    newsletterLabel: 'Newsletter',
    onNewsletterClick: () => console.log('Newsletter clicked'),
    logoutLabel: 'Logout',
    onLogout: () => console.log('Logout'),
  } as UserDropdownProps,
  texts: {
    settingsLabel: 'Settings',
    backLabel: 'Back',
    languageLabel: 'Language',
  } as TecmaHeaderTexts,
};

export const Internationalized = Template.bind({});
Internationalized.storyName = 'Internationalized (Italian)';
Internationalized.args = {
  labelUserLogged: 'Mario Rossi',
  settingsDropdownItems: [
    { isVisible: true, iconName: 'cog', label: 'Preferenze', onClick: () => console.log('Preferences') } as DropdownItem,
    { isVisible: true, iconName: 'bell', label: 'Notifiche', onClick: () => console.log('Notifications') } as DropdownItem,
  ],
  userDropdown: {
    userLogged: 'Manager venditore',
    phone: '3343304569',
    email: 'm.rossi@email.com',
    useOTP: true,
    otpLabel: 'OTP',
    otpSubLabel: 'Non attivo',
    onOtpClick: () => console.log('OTP clicked'),
    languages: [
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom' },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia', selected: true },
      { value: 'es-ES', label: 'Español', subLabel: 'España' },
    ],
    onLanguageSelect: (value: string) => console.log('Lingua selezionata:', value),
    resourcesLabel: 'Risorse',
    onResourcesClick: () => console.log('Resources clicked'),
    newsletterLabel: 'Newsletter',
    onNewsletterClick: () => console.log('Newsletter clicked'),
    logoutLabel: 'Esci',
    onLogout: () => console.log('Logout'),
  } as UserDropdownProps,
  texts: {
    settingsLabel: 'Impostazioni',
    backLabel: 'Indietro',
    languageLabel: 'Lingua',
  } as TecmaHeaderTexts,
};

export const DebugLanguageSelection = Template.bind({});
DebugLanguageSelection.storyName = 'Debug Language Selection';
DebugLanguageSelection.args = {
  labelUserLogged: 'Debug User',
  selectedLanguage: 'it-IT', // This should match one of the languages below
  settingsDropdownItems: [
    { isVisible: true, iconName: 'cog', label: 'Settings', onClick: () => console.log('Settings') } as DropdownItem,
  ],
  userDropdown: {
    userLogged: 'Debug Manager',
    phone: '3343304569',
    email: 'debug@email.com',
    useOTP: true,
    otpLabel: 'OTP',
    otpSubLabel: 'Active',
    onOtpClick: () => console.log('OTP clicked'),
    languages: [
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom' },
      { value: 'en-US', label: 'English', subLabel: 'United States' },
      { value: 'es-ES', label: 'Español', subLabel: 'España' },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia' }, // This should be selected
      { value: 'fr-FR', label: 'Français', subLabel: 'France' },
    ],
    onLanguageSelect: (value: string) => {
      console.log('Language selected in debug:', value);
    },
    resourcesLabel: 'Resources',
    onResourcesClick: () => console.log('Resources clicked'),
    newsletterLabel: 'Newsletter',
    onNewsletterClick: () => console.log('Newsletter clicked'),
    logoutLabel: 'Logout',
    onLogout: () => console.log('Logout'),
  } as UserDropdownProps,
  texts: {
    settingsLabel: 'Settings',
    backLabel: 'Back',
    languageLabel: 'Language',
  } as TecmaHeaderTexts,
};

export const WithoutSettings = Template.bind({});
WithoutSettings.storyName = 'Without Settings Dropdown';
WithoutSettings.args = {
  labelUserLogged: 'User Only',
  userDropdown: {
    userLogged: 'Simple User',
    phone: '3343304569',
    email: 'user.only@email.com',
    useOTP: false,
    languages: [
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom', selected: true },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia' },
      { value: 'es-ES', label: 'Español', subLabel: 'España' },
    ],
    onLanguageSelect: (value: string) => {
      console.log('Language selected:', value);
    },
    resourcesLabel: 'Resources',
    onResourcesClick: () => console.log('Resources clicked'),
    newsletterLabel: 'Newsletter',
    onNewsletterClick: () => console.log('Newsletter clicked'),
    logoutLabel: 'Logout',
    onLogout: () => console.log('Logout'),
  } as UserDropdownProps,
  selectedLanguage: 'en-UK',
  texts: {
    backLabel: 'Back',
    languageLabel: 'Language',
  } as TecmaHeaderTexts,
};

export const WithLongStrings = Template.bind({});
WithLongStrings.storyName = 'With Very Long Strings (Text Truncation Test)';
WithLongStrings.args = {
  labelUserLogged: 'Name and surname',
  settingsDropdownItems: [
    { isVisible: true, iconName: 'cog', label: 'This is a very long settings preference label that should be truncated', onClick: () => console.log('Preferences') } as DropdownItem,
    { isVisible: true, iconName: 'bell', label: 'Another extremely long notification settings label for testing text truncation', onClick: () => console.log('Notifications') } as DropdownItem,
  ],
  userDropdown: {
    userLogged: 'This is a very long user role description that should be truncated properly in the dropdown',
    phone: '+39 334 330 4569 1234 5678 9012 3456',
    email: 'this.is.a.very.long.email.address.that.should.be.truncated@example.com',
    useOTP: true,
    otpLabel: 'OTP: Two-Factor Authentication',
    otpSubLabel: 'This is a very long OTP status description that should be truncated',
    onOtpClick: () => console.log('OTP clicked'),
    languages: [
      { value: 'en-UK', label: 'English (United Kingdom)', subLabel: 'This is a very long language sublabel that should be truncated properly' },
      { value: 'en-US', label: 'English (United States)', subLabel: 'Another extremely long sublabel for testing text truncation in the language selector' },
      { value: 'es-ES', label: 'Español (España)', subLabel: 'Una etiqueta muy larga en español para probar el truncamiento de texto', selected: true },
      { value: 'it-IT', label: 'Italiano (Italia)', subLabel: 'Un\'etichetta molto lunga in italiano per testare il troncamento del testo' },
      { value: 'fr-FR', label: 'Français (France)', subLabel: 'Une étiquette très longue en français pour tester le troncage du texte' },
    ],
    onLanguageSelect: (value: string) => {
      console.log('Language selected:', value);
    },
    resourcesLabel: 'Resources and Documentation Center',
    onResourcesClick: () => console.log('Resources clicked'),
    newsletterLabel: 'Newsletter',
    onNewsletterClick: () => console.log('Newsletter clicked'),
    logoutLabel: 'Logout',
    onLogout: () => console.log('Logout'),
  } as UserDropdownProps,
  texts: {
    settingsLabel: 'Settings',
    backLabel: 'Back',
    languageLabel: 'Language',
  } as TecmaHeaderTexts,
};

export const FixedWidthDropdown = Template.bind({});
FixedWidthDropdown.storyName = 'Fixed Width Dropdown (232px)';
FixedWidthDropdown.args = {
  labelUserLogged: 'Test User',
  settingsDropdownItems: [
    { isVisible: true, iconName: 'cog', label: 'Settings', onClick: () => console.log('Settings') } as DropdownItem,
    { isVisible: true, iconName: 'bell', label: 'Notifications', onClick: () => console.log('Notifications') } as DropdownItem,
  ],
  userDropdown: {
    userLogged: 'Test Manager',
    phone: '+39 334 330 4569',
    email: 'test.user@example.com',
    useOTP: true,
    otpLabel: 'OTP',
    otpSubLabel: 'Active',
    onOtpClick: () => console.log('OTP clicked'),
    languages: [
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom' },
      { value: 'en-US', label: 'English', subLabel: 'United States' },
      { value: 'es-ES', label: 'Español', subLabel: 'España' },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia' },
      { value: 'fr-FR', label: 'Français', subLabel: 'France' },
      { value: 'de-DE', label: 'Deutsch', subLabel: 'Deutschland' },
      { value: 'pt-PT', label: 'Português', subLabel: 'Portugal' },
    ],
    onLanguageSelect: (value: string) => {
      console.log('Language selected:', value);
    },
    resourcesLabel: 'Resources',
    onResourcesClick: () => console.log('Resources clicked'),
    newsletterLabel: 'Newsletter',
    onNewsletterClick: () => console.log('Newsletter clicked'),
    logoutLabel: 'Logout',
    onLogout: () => console.log('Logout'),
  } as UserDropdownProps,
  selectedLanguage: 'en-US',
  texts: {
    settingsLabel: 'Settings',
    backLabel: 'Back',
    languageLabel: 'Language',
  } as TecmaHeaderTexts,
};
FixedWidthDropdown.parameters = {
  docs: {
    description: {
      story: 'This story demonstrates the fixed 232px width of the dropdown. The dropdown maintains the same width in both the main menu and the language selection drawer. When selecting different languages, the check icon appears/disappears without changing the element width, as the icon is positioned absolutely and space is always reserved.',
    },
  },
};

export const WithCalendarSettings = Template.bind({});
WithCalendarSettings.storyName = 'With Calendar Settings';
WithCalendarSettings.args = {
  labelUserLogged: 'Mario Rossi',
  settingsDropdownItems: [
    { isVisible: true, iconName: 'calendar', label: 'Calendar settings', onClick: () => console.log('Calendar settings clicked') } as DropdownItem,
    { isVisible: true, iconName: 'cog', label: 'Preferences', onClick: () => console.log('Preferences') } as DropdownItem,
    { isVisible: true, iconName: 'bell', label: 'Notifications', onClick: () => console.log('Notifications') } as DropdownItem,
  ],
  userDropdown: {
    userLogged: 'Vendor manager',
    phone: '3343304569',
    email: 'm.rossi@email.com',
    useOTP: true,
    otpLabel: 'OTP',
    otpSubLabel: 'Not active',
    onOtpClick: () => console.log('OTP clicked'),
    languages: [
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom', selected: true },
      { value: 'en-US', label: 'English', subLabel: 'United States' },
      { value: 'es-ES', label: 'Español', subLabel: 'España' },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia' },
    ],
    onLanguageSelect: (v: string) => console.log('Language selected:', v),
    resourcesLabel: 'Resources',
    onResourcesClick: () => console.log('Resources clicked'),
    newsletterLabel: 'Newsletter',
    onNewsletterClick: () => console.log('Newsletter clicked'),
    logoutLabel: 'Logout',
    onLogout: () => console.log('Logout'),
  } as UserDropdownProps,
  texts: {
    settingsLabel: 'Settings',
    backLabel: 'Back',
    languageLabel: 'Language',
  } as TecmaHeaderTexts,
};

export default {
  title: 'Components/TecmaHeader',
  component: TecmaHeader,
  parameters: {
    componentSubtitle: 'Header component for application navigation with language selection support.',
    docs: {
      description: {
        component: 'The TecmaHeader component provides a fixed header with settings dropdown and user dropdown. The user dropdown includes language selection functionality with visual feedback for the selected language. The selectedLanguage prop allows pre-setting a language (e.g., from API) while still allowing user interaction. Phone and email fields include copy-to-clipboard functionality when clicking the duplicate icon. All hardcoded texts can be internationalized using the texts prop.',
      },
    },
  },
  argTypes: {
    className: {
      description: 'Additional CSS class name',
      control: 'text',
    },
    labelUserLogged: {
      description: 'Label for the logged user button',
      control: 'text',
    },
    onUserClick: {
      description: 'Callback when user info is clicked',
      action: 'user-clicked',
    },
    settingsDropdownItems: {
      description: 'Array of dropdown items for settings menu (optional). If not provided or empty, the settings button and divider will not be rendered.',
      control: 'object',
    },
    headerActions: {
      description: 'Optional top-level actions rendered before Settings. Useful for custom actions like Support.',
      control: 'object',
    },
    userDropdown: {
      description: 'Configuration object for the user dropdown with language selection support',
      control: 'object',
    },
    selectedLanguage: {
      description: 'Pre-selected language value (e.g., from API). If provided, overrides internal state management.',
      control: 'text',
    },
    texts: {
      description: 'Internationalization texts for hardcoded strings in the component.',
      control: 'object',
    },
  },
} as Meta<typeof TecmaHeader>;
