import React, { ReactNode, useState, ComponentType } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { useDevice } from '../../hooks/useDevice';
import { Drawer } from '../Drawer';
import { LazyImage } from '../LazyImage';
import HeaderItem from './HeaderItem';
import HeaderLanguageSelector from './HeaderLanguageSelector';
import HeaderMenuItem from './HeaderMenuItem';
import HeaderMenuItemDivider from './HeaderMenuItemDivider';

// styles
import '../../styles/header.scss';

// Required Props
interface HeaderRequiredProps {
  logo: string;
  desktopHeaderContent: ReactNode;
}

// Optional Props
interface HeaderOptionalProps extends DefaultProps {
  mobileHeaderContent?: ReactNode;
  mobileDrawerContent?: ReactNode;
  mobileDrawerTitle?: string;
  logoWrapper?: ComponentType<{ children: ReactNode }>;
}

// Combined required and optional props to build the full prop interface
export interface HeaderProps extends HeaderRequiredProps, HeaderOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: HeaderOptionalProps = {
  'data-testid': 'tecma-header',
};

const Header: React.FC<HeaderProps> = ({
  className,
  logo,
  desktopHeaderContent,
  mobileHeaderContent,
  mobileDrawerContent,
  mobileDrawerTitle,
  logoWrapper: LogoWrapper = '',
  ...rest
}) => {
  const classList = classNames('tecma-header', className);
  const device = useDevice();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  return (
    <nav className={classList} {...rest}>
      {LogoWrapper ? (
        <LogoWrapper>
          <LazyImage.Image className='tecma-header-logo' src={logo} errorElement={<> </>} loadingElement={<> </>} />
        </LogoWrapper>
      ) : (
        <LazyImage.Image className='tecma-header-logo' src={logo} errorElement={<> </>} loadingElement={<> </>} />
      )}
      <div className='tecma-header-utility-menu'>
        {device.type === 'desktop' ? desktopHeaderContent : mobileHeaderContent}
        {device.type !== 'desktop' && !!mobileDrawerContent && (
          <>
            <HeaderItem className='toggle-drawer-button' iconName='menu' onClick={toggleDrawer} />
            <Drawer open={isDrawerOpen} onClose={toggleDrawer} anchor='right'>
              <Drawer.Header onClose={toggleDrawer} label={mobileDrawerTitle} />
              {mobileDrawerContent}
            </Drawer>
          </>
        )}
      </div>
    </nav>
  );
};

Header.defaultProps = defaultProps as Partial<HeaderOptionalProps>;

const HeaderSpace = Object.assign(Header, {
  Item: HeaderItem,
  MenuItem: HeaderMenuItem,
  Divider: HeaderMenuItemDivider,
  LanguageSelector: HeaderLanguageSelector,
});

export default HeaderSpace;
