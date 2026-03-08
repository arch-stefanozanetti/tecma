import React, { FC, ReactElement, useState, useMemo, useEffect } from 'react';
import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { NavigationItem } from '../NavigationItem';
import { Drawer } from '../Drawer';
import { Icon, IconURLContext } from '../Icon';
import { TecmaHeaderTexts, UserDropdownProps, DropdownItem, HeaderAction } from '../TecmaHeader/TecmaHeader';

import '../../styles/tecmaHeaderMobile.scss';

export interface TecmaHeaderMobileProps extends DefaultProps {
  className?: string;
  labelUserLogged: string;
  headerActions?: HeaderAction[];
  settingsDropdownItems: DropdownItem[];
  userDropdown: UserDropdownProps;
  selectedLanguage: string;
  texts: TecmaHeaderTexts;
  logo?: string | React.ReactNode;
}

const TecmaHeaderMobile: FC<TecmaHeaderMobileProps> = ({ 
  className, 
  labelUserLogged, 
  headerActions,
  settingsDropdownItems,
  userDropdown,
  selectedLanguage,
  texts,
  logo,
  ...rest 
}): ReactElement => {
  const headerClassList = classNames('header-mobile', className);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [localSelectedLanguage, setLocalSelectedLanguage] = useState(selectedLanguage);

  // Sync local state with prop when it changes
  useEffect(() => {
    setLocalSelectedLanguage(selectedLanguage);
  }, [selectedLanguage]);

  // Determine the language to show in the first-level item
  const currentLanguage = useMemo(() => {
    if (!userDropdown?.languages || userDropdown.languages.length === 0) return undefined;
    const byValue = localSelectedLanguage
      ? userDropdown.languages.find((l) => l.value === localSelectedLanguage)
      : undefined;
    if (byValue) return byValue;
    const preselected = userDropdown.languages.find((l) => l.selected);
    return preselected;
  }, [userDropdown?.languages, localSelectedLanguage]);

  // Function to copy text to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Text copied to clipboard:', text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const renderSettingsDrawer = useMemo(() => {
    return (
      <Drawer
        hideBackdrop
        open={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
        anchor="right"
        className="header-mobile-drawer" // Positioned between header (60px) and mobile sidebar (80px)
      >
        <Drawer.Header onClose={() => setIsSettingsDrawerOpen(false)} />
        <Drawer.Content>
          {settingsDropdownItems
            .filter((item) => item.isVisible)
            .map((item, index) => (
              <Drawer.Item
                key={`settings-item-${index}`}
                style={{fontWeight: 700}}
                iconName={item.iconName}
                label={item.label}
                onClick={() => {
                  item.onClick();
                  setIsSettingsDrawerOpen(false);
                }}
              />
            ))}
        </Drawer.Content>
      </Drawer>
    );
  }, [settingsDropdownItems, isSettingsDrawerOpen, texts]);

  const renderHeaderActions = useMemo(() => {
    if (!headerActions || headerActions.length === 0) {
      return null;
    }

    return headerActions
      .filter((action) => action.isVisible !== false)
      .map((action, index) => (
        <NavigationItem
          key={action.id || `header-mobile-action-${index}`}
          iconName={action.iconName}
          label={action.label}
          isCollapsed
          aria-label={action.ariaLabel || action.label}
          id={action.id}
          onClick={action.onClick}
          className='header-mobile-button'
        />
      ));
  }, [headerActions]);

  const renderUserDrawer = useMemo(() => {
    if (!userDropdown) {
      return null;
    }

    const {
      userLogged,
      phone,
      email,
      useOTP,
      otpLabel,
      otpSubLabel,
      onOtpClick,
      languages = [],
      onLanguageSelect,
      resourcesLabel,
      onResourcesClick,
      logoutLabel,
      onLogout,
      newsletterLabel,
      onNewsletterClick,
    } = userDropdown;

    return (
      <Drawer
        hideBackdrop
        open={isUserDrawerOpen}
        onClose={() => setIsUserDrawerOpen(false)}
        anchor="right"
        className="header-mobile-drawer" // Positioned between header (60px) and mobile sidebar (80px)
      >
        <Drawer.Header onClose={() => setIsUserDrawerOpen(false)}/>
        <Drawer.Content>
          {/* User Avatar card (same as Drawer basic story) */}
          <Drawer.Avatar avatarProps={{ text: (userLogged?.split(' ')?.map((p)=>p[0]).join('') || 'U').slice(0,2).toUpperCase() }} title={userLogged || ''} subtitle={userLogged}>
            {phone && (
              <div className='drawer-avatar-extra-row'>
                <Icon iconName='duplicate' />
                <span>{phone}</span>
              </div>
            )}
            {email && (
              <div className='drawer-avatar-extra-row'>
                <Icon iconName='duplicate' />
                <span>{email}</span>
              </div>
            )}
          </Drawer.Avatar>

          {/* OTP Section */}
          {useOTP && (
            <Drawer.Item
              iconName="shield-check"
              label={otpLabel || 'OTP'}
              description={otpSubLabel}
              onClick={() => {
                onOtpClick && onOtpClick();
                setIsUserDrawerOpen(false);
              }}
            />
          )}

          {/* Language Section */}
          <Drawer.Item
            iconName="translate"
            label={currentLanguage?.label || texts.languageLabel || 'Language'}
            description={currentLanguage?.subLabel}
            rightIcon="chevron-right"
            onClick={() => setIsLanguageMenuOpen(true)}
          />

          {/* Resources Section */}
          {resourcesLabel && (
            <Drawer.Item
              iconName="book-open"
              label={resourcesLabel}
              rightIcon="external-link"
              onClick={() => {
                onResourcesClick && onResourcesClick();
                setIsUserDrawerOpen(false);
              }}
            />
          )}

          {/* Newsletter Section */}
          {newsletterLabel && (
            <Drawer.Item
              iconName="mail"
              label={newsletterLabel}
              onClick={() => {
                onNewsletterClick && onNewsletterClick();
              }}
            />
          )}

          {/* Logout Section */}
          <Drawer.Item
            iconName="logout"
            label={logoutLabel || 'Logout'}
            onClick={() => {
              onLogout && onLogout();
              setIsUserDrawerOpen(false);
            }}
          />
        </Drawer.Content>
      </Drawer>
    );
  }, [userDropdown, isUserDrawerOpen, labelUserLogged, localSelectedLanguage, currentLanguage, texts]);

  const renderLanguageDrawer = useMemo(() => {
    if (!userDropdown?.languages) return null;

    return (
      <Drawer
        hideBackdrop
        open={isLanguageMenuOpen}
        onClose={() => setIsLanguageMenuOpen(false)}
        anchor="right"
        className="header-mobile-drawer" // Positioned between header (60px) and mobile sidebar (80px)
      >
        <Drawer.Header isNestedHeader onClose={() => setIsLanguageMenuOpen(false)} label={texts.languageLabel || 'Language'} />
        <Drawer.Content>
          {userDropdown.languages.map((lng, idx) => {
            const isSelected = localSelectedLanguage ? localSelectedLanguage === lng.value : lng.selected;
            return (
              <Drawer.Item
                key={`lng-${idx}`}
                rightIcon={isSelected ? 'check' : undefined}
                label={lng.label}
                description={lng.subLabel}
                className={classNames('language-item', { selected: isSelected })}
                onClick={() => {
                  setLocalSelectedLanguage(lng.value);
                  userDropdown.onLanguageSelect && userDropdown.onLanguageSelect(lng.value);
                  // keep drawer open; user will navigate back with header chevron
                }}
              />
            );
          })}
        </Drawer.Content>
      </Drawer>
    );
  }, [isLanguageMenuOpen, userDropdown?.languages, localSelectedLanguage, texts]);

  const renderLogo = () => {
    if (logo) {
      if (typeof logo === 'string') {
        return <img src={logo} alt="Logo" className="header-mobile-logo-image" />;
      }
      return logo;
    }
    return null;
  };

  return (
    <>
      <div className={headerClassList} data-testid="tecma-header-mobile" {...rest}>
        <div className="header-mobile-content">
          <div className="header-mobile-logo">
            {renderLogo()}
          </div>
          <div className="header-mobile-actions">
            {renderHeaderActions}
            {settingsDropdownItems?.length > 0 && (
              <NavigationItem
                iconName="cog"
                label=""
                isCollapsed
                onClick={() => setIsSettingsDrawerOpen(true)}
                className={classNames('header-mobile-button', { active: isSettingsDrawerOpen })}
              />
            )}
            <NavigationItem
              iconName="user-circle"
              label=""
              isCollapsed
              onClick={() => setIsUserDrawerOpen(true)}
              className={classNames('header-mobile-button', { active: isUserDrawerOpen })}
            />
          </div>
        </div>
      </div>
      
      <IconURLContext.Provider value="/ds-icons">
        {renderSettingsDrawer}
        {renderUserDrawer}
        {renderLanguageDrawer}
      </IconURLContext.Provider>
    </>
  );
};

export default TecmaHeaderMobile;
