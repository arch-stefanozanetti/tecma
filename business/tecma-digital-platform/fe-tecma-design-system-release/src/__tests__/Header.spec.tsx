/* eslint-disable no-alert */
import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';

import { Drawer } from '../components/Drawer';
import Header, { HeaderProps } from '../components/Header/Header';
import { DeviceContext } from '../context/device';
import performStandardTest from '../helpers/performStandardTest';

const desktopHeaderContent = (
  <>
    <Header.Item label='Mario Rossi' iconName='user-circle'>
      <Header.MenuItem title='Mario Rossi' subtitle='Vendor Manager' />
      <Header.Divider />
      <Header.MenuItem title='Logout' onClick={() => alert('Logout clicked')} />
    </Header.Item>
    <Header.LanguageSelector languages={['de-DE', 'en-GB']} currentLanguage='en-GB' onChangeLanguage={() => {}} />
    <Header.Item label='Contact us' iconName='headset' onClick={() => alert('Contact us clicked')} />
  </>
);

const mobileHeaderContent = <Header.Item iconName='headset' onClick={() => alert('Contact us clicked on mobile')} />;

const mobileDrawerContent = (
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
);

const defaultProps: HeaderProps = {
  'data-testid': 'Tecma-header',
  logo: 'https://businessplatform-biz-tecma-dev1.tecmasolutions.com/static/media/tecma_logo.43d5d648.svg',
  desktopHeaderContent,
  mobileHeaderContent,
  mobileDrawerContent,
};

describe('Header Component', () => {
  performStandardTest(Header, defaultProps, 'Tecma-header');

  it('Should render Desktop Header', async () => {
    render(
      <DeviceContext forceDevice='desktop'>
        <Header {...defaultProps} />
      </DeviceContext>,
    );
    await waitFor(async () => {
      expect(await screen.findByTestId(defaultProps['data-testid'] as string)).toMatchSnapshot();
    });
  });

  it('Should render Mobile Header', async () => {
    render(
      <DeviceContext forceDevice='mobile'>
        <Header {...defaultProps} />
      </DeviceContext>,
    );
    await waitFor(async () => {
      expect(await screen.findByTestId(defaultProps['data-testid'] as string)).toMatchSnapshot();
    });
  });

  it('Should render Drawer toggle button if mobileDrawerContent is provided', async () => {
    const { container } = render(
      <DeviceContext forceDevice='mobile'>
        <Header {...defaultProps} />
      </DeviceContext>,
    );
    await waitFor(() => {
      const toggleDrawerButton = container.querySelector('.toggle-drawer-button');
      expect(toggleDrawerButton).toBeInTheDocument();
    });
  });
});
