/* eslint-disable no-alert */
import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { Button } from '../components/Button';
import { Drawer, DrawerProps } from '../components/Drawer/Drawer';
import DrawerContent from '../components/Drawer/DrawerContent';
import DrawerHeader from '../components/Drawer/DrawerHeader';
import DrawerItem from '../components/Drawer/DrawerItem';
import DrawerLanguages from '../components/Drawer/DrawerLanguages';

// 👇 We create a “template” of how args map to rendering
const Template: Story<DrawerProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const handleOnClose = () => setIsOpen(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(!isOpen)}>open drawer</Button>
      <Drawer {...args} open={isOpen} onClose={handleOnClose} />
    </div>
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
Basic.args = {
  children: [
    <Drawer.Header onClose={() => alert('close drawer')} />,
    <Drawer.Content>
      <Drawer.Avatar avatarProps={{ text: 'MR' }} title='Mario Rossi' subtitle='Vendor Manager' />
      <Drawer.Item label='FAQ' onClick={() => alert('faq clicked')} iconName='book-open' />
      <Drawer.Item label='Support' onClick={() => alert('support clicked')} iconName='headset' />
    </Drawer.Content>,
    <Drawer.Footer>
      <Drawer.Item label='Logout' iconName='logout' onClick={() => alert('logout clicked')} />
    </Drawer.Footer>,
  ],
};

export const MenuLayout: Story<DrawerProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const handleOnClose = () => setIsOpen(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(!isOpen)}>open drawer</Button>
      <Drawer {...args} open={isOpen} onClose={handleOnClose}>
        <Drawer.Header onClose={handleOnClose} />
        <Drawer.Content>
          <Drawer.Avatar avatarProps={{ text: 'MR' }} title='Mario Rossi' subtitle='Vendor Manager' />
          <div>
            <Drawer.Item label='Resources' iconName='book-open' rightIcon='chevron-right' menuLayout='accordion'>
              <Drawer.Item label='Tutorial' onClick={() => alert('tutorial clicked')} rightIcon='chevron-right' />
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
      </Drawer>
    </div>
  );
};

export const Languages: Story<DrawerProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const handleOnClose = () => setIsOpen(false);
  const [language, setLanguage] = useState('en-GB');

  const handleOnChangeLanguage = (newLang: string) => {
    setLanguage(newLang);
  };

  return (
    <div>
      <Button onClick={() => setIsOpen(!isOpen)}>open drawer</Button>
      <Drawer {...args} open={isOpen} onClose={handleOnClose}>
        <Drawer.Header label='menu' onClose={handleOnClose} />
        <Drawer.Content>
          <Drawer.Avatar avatarProps={{ text: 'MR' }} title='Mario Rossi' subtitle='Vendor Manager' />
          <div>
            <Drawer.Item label='FAQ' onClick={() => alert('faq clicked')} iconName='book-open' />
            <Drawer.Item label='Support' onClick={() => alert('support clicked')} iconName='headset' />
            <Drawer.Item label='Language' iconName='translate' rightIcon='chevron-right' menuLayout='page'>
              <DrawerLanguages
                currentLanguage={language}
                onChangeLanguage={handleOnChangeLanguage}
                languages={['en-US', 'es-US', 'de-DE', 'en-IN', 'en-GB', 'es-ES', 'it-IT', 'fr-FR']}
              />
            </Drawer.Item>
          </div>
        </Drawer.Content>
      </Drawer>
    </div>
  );
};

export default {
  title: 'Components/Drawer',
  component: Drawer,
  parameters: {
    componentSubtitle:
      'The navigation drawers provide ergonomic access to destinations in a site or app functionality such as switching accounts.',
    design: {
      type: 'figma',
      url: '',
    },
  },
  argTypes: {
    anchor: {
      description: 'Side from which the drawer will appear.',
      defaultValue: 'right',
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
    },
    hideBackdrop: {
      description: 'if `true`, the backdrop is not rendered',
      control: 'boolean',
    },
    onClose: {
      description: 'Callback fired when the component requests to be closed.',
    },
    open: {
      description: 'If true, the component is shown.',
      defaultValue: false,
      control: 'boolean',
    },
  },
  subcomponents: { DrawerHeader, DrawerContent, DrawerItem, DrawerLanguages },
} as Meta<typeof Drawer>;
