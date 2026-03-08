/* eslint-disable no-alert */
import React from 'react';

import { Story, Meta } from '@storybook/react';

import { Button } from '../components/Button';
import { Drawer } from '../components/Drawer';
import Header, { HeaderProps } from '../components/Header/Header';
import { DeviceContext } from '../context/device';

const LogoWrapper: React.FC = ({ children }) => (
  <Button type='button' onClick={() => alert('ALERT')} color='transparent' link>
    {children}
  </Button>
);

// 👇 We create a “template” of how args map to rendering
const Template: Story<HeaderProps> = (args) => (
  <div style={{ width: '95vw', maxWidth: '1000px', boxSizing: 'border-box' }}>
    <Header
      {...args}
      desktopHeaderContent={
        <>
          <Header.Item label='Mario Rossi' iconName='user-circle'>
            <Header.MenuItem title='Mario Rossi' subtitle='Vendor Manager' />
            <Header.Divider />
            <Header.MenuItem title='Logout' onClick={() => alert('Logout clicked')} />
          </Header.Item>
          <Header.LanguageSelector languages={['de-DE', 'en-GB']} currentLanguage='en-GB' onChangeLanguage={() => {}} />
          <Header.Item label='Contact us' iconName='headset' onClick={() => alert('Contact us clicked')} />
        </>
      }
      mobileHeaderContent={<Header.Item iconName='headset' onClick={() => alert('Contact us clicked on mobile')} />}
      mobileDrawerTitle='Menu da mobile'
      mobileDrawerContent={
        <>
          <Drawer.Content>
            <Drawer.Avatar avatarProps={{ text: 'MR' }} title='Mario Rossi' subtitle='Vendor Manager' />
            <div>
              <Drawer.Item label='Resources' iconName='book-open' rightIcon='chevron-right' menuLayout='accordion'>
                <Drawer.Item label='Tutorial' onClick={() => alert('tutorial clicked')} />
                <Drawer.Item label='FAQu' onClick={() => alert('FAQ clicked')} iconName='translate' />
                <Drawer.Item label='FAQ' onClick={() => alert('FAQ clicked')} />
              </Drawer.Item>
              <Drawer.Item label='Language' iconName='translate' rightIcon='chevron-right' menuLayout='page'>
                <Drawer.Item label='FAQ' onClick={() => alert('FAQ clicked')} />
                <Drawer.Item label='Tutorial' onClick={() => alert('tutorial clicked')} />
              </Drawer.Item>
              <Drawer.Item label='Support' onClick={() => alert('support clicked')} iconName='headset' />
            </div>
          </Drawer.Content>

          <Drawer.Footer>
            <Drawer.Item label='Logout' iconName='logout' onClick={() => alert('logout clicked')} />
          </Drawer.Footer>
        </>
      }
      logoWrapper={LogoWrapper}
    />
  </div>
);

// Stories

export const Basic: Story<HeaderProps> = (args) => {
  return (
    <DeviceContext>
      <Template {...args} />
    </DeviceContext>
  );
};
Basic.storyName = 'Basic Usage';

export const Desktop: Story<HeaderProps> = (args) => {
  return (
    <DeviceContext forceDevice='desktop'>
      <Template {...args} />
    </DeviceContext>
  );
};

export const Mobile: Story<HeaderProps> = (args) => {
  return (
    <DeviceContext forceDevice='mobile'>
      <Template {...args} />
    </DeviceContext>
  );
};

export default {
  title: 'Components/Header',
  component: Header,
  parameters: {
    componentSubtitle: 'Header',
    design: {
      type: 'figma',
      url: '',
    },
  },
  argTypes: {
    logo: {
      description: 'Items to render in the nav on desktop',
      defaultValue: 'https://businessplatform-biz-tecma-dev1.tecmasolutions.com/static/media/tecma_logo.43d5d648.svg',
    },
    desktopHeaderContent: {
      description: 'Items to render in the nav on desktop',
    },
    mobileHeaderContent: {
      description: 'Items to render in the nav on mobile, hamburger button is added automatically if mobileDrawerContent is provided',
    },
    mobileDrawerContent: {
      description: 'Items to render in Drawer',
    },
    mobileDrawerTitle: {
      description: 'Title to add in Drawer header',
    },
  },
} as Meta<typeof Header>;
