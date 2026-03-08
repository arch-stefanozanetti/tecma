import React from 'react';
import { Story, Meta } from '@storybook/react';
import TecmaHeaderMobile, { TecmaHeaderMobileProps } from '../components/TecmaHeaderMobile/TecmaHeaderMobile';
import { DropdownItem, UserDropdownProps, TecmaHeaderTexts, HeaderAction } from '../components/TecmaHeader/TecmaHeader';

const Template: Story<TecmaHeaderMobileProps> = (args) => (
  <div style={{ height: '100vh', paddingTop: '80px' }}>
    <TecmaHeaderMobile {...args} />
    <div style={{ padding: '20px' }}>
      <h1>Mobile App Content</h1>
      <p>This is where the main mobile content would go when using the TecmaHeaderMobile component.</p>
      <p>The header is positioned fixed at the top of the page.</p>
    </div>
  </div>
);

export const Default = Template.bind({});
Default.storyName = 'Default Mobile Header';
Default.args = {
  labelUserLogged: 'Mario Rossi',
  selectedLanguage: 'it-IT',
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
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom' },
      { value: 'en-US', label: 'English', subLabel: 'United States' },
      { value: 'es-ES', label: 'Español', subLabel: 'España' },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia', selected: true },
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
  className: 'custom-mobile-header',
  labelUserLogged: 'John Doe',
  selectedLanguage: 'en-UK',
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
  } as UserDropdownProps,
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
  selectedLanguage: 'en-US',
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
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom' },
      { value: 'en-US', label: 'English', subLabel: 'United States', selected: true },
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

export const CopyToClipboardDemo = Template.bind({});
CopyToClipboardDemo.storyName = 'Copy to Clipboard Demo';
CopyToClipboardDemo.args = {
  labelUserLogged: 'Copy Tester',
  selectedLanguage: 'it-IT',
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
      { value: 'en-UK', label: 'English', subLabel: 'United Kingdom' },
      { value: 'it-IT', label: 'Italiano', subLabel: 'Italia', selected: true },
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
  selectedLanguage: 'it-IT',
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

export const CollapsedNavigationItems = Template.bind({});
CollapsedNavigationItems.storyName = 'Collapsed Navigation Items (Icon Only)';
CollapsedNavigationItems.args = {
  labelUserLogged: 'Test User',
  selectedLanguage: 'en-US',
  settingsDropdownItems: [
    { isVisible: true, iconName: 'cog', label: 'Settings', onClick: () => console.log('Settings clicked') } as DropdownItem,
    { isVisible: true, iconName: 'bell', label: 'Notifications', onClick: () => console.log('Notifications clicked') } as DropdownItem,
    { isVisible: true, iconName: 'info', label: 'Info', onClick: () => console.log('Info clicked') } as DropdownItem,
  ],
  userDropdown: {
    userLogged: 'John Doe',
    phone: '+1 555 123 4567',
    email: 'john.doe@example.com',
    useOTP: true,
    otpLabel: 'OTP',
    otpSubLabel: 'Active',
    onOtpClick: () => console.log('OTP clicked'),
    languages: [
      { value: 'en-US', label: 'English', subLabel: 'United States', selected: true },
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
  texts: {
    settingsLabel: 'Settings',
    backLabel: 'Back',
    languageLabel: 'Language',
  } as TecmaHeaderTexts,
};
CollapsedNavigationItems.parameters = {
  docs: {
    description: {
      story: 'This story demonstrates the collapsed NavigationItem components used in the header. The settings and user buttons are rendered with `isCollapsed={true}`, showing only icons without labels. This provides a compact mobile header design.',
    },
  },
};

export default {
  title: 'Components/TecmaHeaderMobile',
  component: TecmaHeaderMobile,
  parameters: {
    componentSubtitle: 'Mobile header component with drawer navigation.',
    docs: {
      description: {
        component: 'The TecmaHeaderMobile component provides a fixed mobile header with settings and user drawers. The user drawer includes language selection functionality with visual feedback for the selected language. Phone and email fields include copy-to-clipboard functionality when clicking the duplicate icon. All hardcoded texts can be internationalized using the texts prop.',
      },
    },
  },
  argTypes: {
    className: {
      description: 'Additional CSS class name',
      control: 'text',
    },
    labelUserLogged: {
      description: 'Label for the logged user',
      control: 'text',
    },
    settingsDropdownItems: {
      description: 'Array of dropdown items for settings menu',
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
} as Meta<typeof TecmaHeaderMobile>;
