import React, { FC, ReactElement, useMemo, useState } from 'react';
import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { NavigationItem } from '../NavigationItem';
import { Button } from '../Button';
import { DropDown } from '../DropDown';
import { Icon, IconURLContext } from '../Icon';
import { IconName } from '../Icon/IconName';
import { Snackbar } from '../Snackbar';

import '../../styles/tecmaHeader.scss';

export interface DropdownItem {
  isVisible: boolean;
  iconName: IconName;
  label: string;
  onClick: () => void;
}

export interface HeaderAction {
  label: string;
  iconName?: IconName;
  onClick: () => void;
  isVisible?: boolean;
  ariaLabel?: string;
  id?: string;
}

interface LanguageOption {
  value: string;
  label: string;
  subLabel?: string;
  selected?: boolean;
}

export interface UserDropdownProps {
  userLogged?: string;
  phone?: string;
  email?: string;
  useOTP?: boolean;
  otpLabel?: string;
  otpSubLabel?: string;
  onOtpClick?: () => void;
  languages?: LanguageOption[];
  onLanguageSelect?: (value: string) => void;
  resourcesLabel?: string;
  onResourcesClick?: () => void;
  logoutLabel?: string;
  onLogout?: () => void;
  newsletterLabel?: string;
  onNewsletterClick?: () => void;
}

export interface TecmaHeaderTexts {
  settingsLabel?: string;
  backLabel?: string;
  languageLabel?: string;
}

export interface TecmaHeaderProps extends DefaultProps {
  className?: string;
  labelUserLogged: string;
  headerActions?: HeaderAction[];
  settingsDropdownItems?: DropdownItem[];
  userDropdown: UserDropdownProps;
  selectedLanguage: string;
  texts: TecmaHeaderTexts;
  messageCopiedTranslated?: string;
}

const TecmaHeader: FC<TecmaHeaderProps> = ({
  className,
  labelUserLogged,
  headerActions,
  settingsDropdownItems,
  userDropdown,
  selectedLanguage,
  texts,
  messageCopiedTranslated,
  ...rest
}): ReactElement => {
  const headerClassList = classNames('header', className);
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);

  // Determine the language to show in the first-level item
  const currentLanguage = useMemo(() => {
    if (!userDropdown?.languages || userDropdown.languages.length === 0) return undefined;
    const byValue = selectedLanguage ? userDropdown.languages.find((l) => l.value === selectedLanguage) : undefined;
    if (byValue) return byValue;
    const preselected = userDropdown.languages.find((l) => l.selected);
    return preselected;
  }, [userDropdown?.languages, selectedLanguage]);

  // Function to copy text to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsSnackbarOpen(true);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsSnackbarOpen(true);
    }
  };

  const renderSettingsComponent = useMemo(() => {
    if (!settingsDropdownItems || settingsDropdownItems.length === 0) {
      return null;
    }

    return (
      <IconURLContext.Provider value='/ds-icons'>
        <DropDown
          leftIcon
          isOpen={isSettingsDropdownOpen}
          onToggle={() => setIsSettingsDropdownOpen((prev) => !prev)}
          position={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          className='header-dropdown'
          triggerProps={{
            iconName: 'cog',
            children: texts?.settingsLabel || 'Settings',
            onClick: () => setIsSettingsDropdownOpen((prev) => !prev),
            className: 'btn-header',
            color: 'transparent',
          }}
        >
          {settingsDropdownItems
            .filter((item) => item.isVisible)
            .map((item, index) => (
              <DropDown.Item
                key={`settings-item-${index}`}
                onClick={() => {
                  item.onClick();
                  setIsSettingsDropdownOpen(false);
                }}
              >
                <div className='dropdown-item'>
                  <Icon iconName={item.iconName} size='medium' />
                  <span>{item.label}</span>
                </div>
              </DropDown.Item>
            ))}
        </DropDown>
      </IconURLContext.Provider>
    );
  }, [settingsDropdownItems, isSettingsDropdownOpen, texts]);

  const renderHeaderActions = useMemo(() => {
    if (!headerActions || headerActions.length === 0) {
      return null;
    }

    return headerActions
      .filter((action) => action.isVisible !== false)
      .map((action, index) => (
        <Button
          key={action.id || `header-action-${index}`}
          iconName={action.iconName}
          color='transparent'
          aria-label={action.ariaLabel || action.label}
          id={action.id}
          onClick={action.onClick}
          className='btn-header'
        >
          {action.label}
        </Button>
      ));
  }, [headerActions]);

  const renderUserComponent = useMemo(() => {
    if (!userDropdown) {
      return <NavigationItem iconName='user-circle' label={labelUserLogged} onClick={() => {}} className='btn-header' />;
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
      <IconURLContext.Provider value='/ds-icons'>
        <DropDown
          leftIcon
          isOpen={isUserDropdownOpen}
          onToggle={() => setIsUserDropdownOpen((prev) => !prev)}
          position={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          className='header-dropdown'
          triggerProps={{
            iconName: 'user-circle',
            children: labelUserLogged,
            onClick: () => setIsUserDropdownOpen((prev) => !prev),
            className: 'btn-header',
            color: 'transparent',
          }}
        >
          <li
            className={classNames('dropdown-menu-container', { 'language-menu-open': isLanguageMenuOpen })}
            style={{ position: 'relative', width: '100%', listStyle: 'none', padding: 0, margin: 0 }}
          >
            <div className={classNames('dropdown-menu-panel', 'dropdown-menu-main', { 'menu-hidden': isLanguageMenuOpen })}>
              <div className='wrapper-profile-info'>
                {userLogged && (
                  <div className='profile-item'>
                    <div className='title'>{userLogged}</div>
                  </div>
                )}
                {phone && (
                  <div
                    className='profile-item'
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(phone);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className='container-text-info'>
                      <Icon iconName='duplicate' style={{ cursor: 'pointer' }} />
                      <span className='phone-text'>{phone}</span>
                    </div>
                  </div>
                )}
                {email && (
                  <div
                    className='profile-item'
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(email);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className='container-text-info'>
                      <Icon iconName='duplicate' style={{ cursor: 'pointer' }} />
                      <span className='email-text'>{email}</span>
                    </div>
                  </div>
                )}
              </div>
              <DropDown.Divider />
              {useOTP && (
                <DropDown.Item
                  onClick={() => {
                    if (onOtpClick) {
                      onOtpClick();
                    }
                    setIsUserDropdownOpen(false);
                  }}
                >
                  <div className='dropdown-item'>
                    <Icon iconName='shield-check' size='medium' />
                    <div className='otp-container'>
                      <div className='otp-label'>{otpLabel}</div>
                      <div className='sub-label'>{otpSubLabel}</div>
                    </div>
                  </div>
                </DropDown.Item>
              )}
              <DropDown.Item onClick={() => setIsLanguageMenuOpen(true)}>
                <div className='dropdown-item' style={{ justifyContent: 'space-between', width: '100%' }}>
                  <div className='language-label-wrapper'>
                    <Icon iconName='translate' size='medium' />
                    <div className='language-label-container'>
                      <div className='language-label'>{currentLanguage?.label || texts?.languageLabel || 'Language'}</div>
                      {currentLanguage?.subLabel && <div className='sub-label'>{currentLanguage.subLabel}</div>}
                    </div>
                  </div>
                  <Icon iconName='chevron-right' />
                </div>
              </DropDown.Item>
              {resourcesLabel && (
                <DropDown.Item
                  onClick={() => {
                    if (onResourcesClick) {
                      onResourcesClick();
                    }
                    setIsUserDropdownOpen(false);
                  }}
                >
                  <div className='dropdown-item' style={{ justifyContent: 'space-between', width: '100%' }}>
                    <div className='resources-label-wrapper'>
                      <Icon iconName='book-open' size='medium' />
                      <span>{resourcesLabel}</span>
                    </div>
                    <Icon iconName='external-link' size='medium' />
                  </div>
                </DropDown.Item>
              )}
              {newsletterLabel && (
                <DropDown.Item
                  onClick={() => {
                    if (onNewsletterClick) {
                      onNewsletterClick();
                    }
                  }}
                >
                  <div className='dropdown-item'>
                    <Icon iconName='mail' size='medium' />
                    <span>{newsletterLabel}</span>
                  </div>
                </DropDown.Item>
              )}
              <DropDown.Item
                onClick={() => {
                  if (onLogout) {
                    onLogout();
                  }
                  setIsUserDropdownOpen(false);
                }}
              >
                <div className='dropdown-item'>
                  <Icon iconName='logout' size='medium' />
                  <span>{logoutLabel}</span>
                </div>
              </DropDown.Item>
            </div>
            <div className={classNames('dropdown-menu-panel', 'dropdown-menu-language', { 'menu-visible': isLanguageMenuOpen })}>
              <DropDown.Item onClick={() => setIsLanguageMenuOpen(false)}>
                <div className='dropdown-item'>
                  <Icon iconName='chevron-left' size='medium' />
                  <span className='back-label'>{texts?.backLabel || 'Back'}</span>
                </div>
              </DropDown.Item>
              <DropDown.Item onClick={() => {}}>
                <div className='dropdown-item'>
                  <Icon iconName='translate' size='medium' />
                  <span className='language-menu-title'>{texts?.languageLabel || 'Language'}</span>
                </div>
              </DropDown.Item>
              <DropDown.Divider />
              <li className='language-items-scrollable-wrapper'>
                <ul className='language-items-scrollable'>
                  {languages.map((lng, idx) => (
                    <DropDown.Item
                      key={`lng-${idx}`}
                      onClick={() => {
                        if (onLanguageSelect) {
                          onLanguageSelect(lng.value);
                        }
                        setIsLanguageMenuOpen(false);
                        setIsUserDropdownOpen(false);
                      }}
                    >
                      <div
                        className={classNames('dropdown-item', { 'language-item-active': selectedLanguage === lng.value || lng.selected })}
                        style={{ justifyContent: 'space-between', width: '100%' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div className='language-label-container'>
                            <div className='language-label'>{lng.label}</div>
                            {lng.subLabel && <div className='sub-label'>{lng.subLabel}</div>}
                          </div>
                        </div>
                        {(selectedLanguage === lng.value || lng.selected) && (
                          <Icon fill={selectedLanguage === lng.value || lng.selected ? 'accent' : 'transparent'} iconName='check' />
                        )}
                      </div>
                    </DropDown.Item>
                  ))}
                </ul>
              </li>
            </div>
          </li>
        </DropDown>
      </IconURLContext.Provider>
    );
  }, [userDropdown, isUserDropdownOpen, isLanguageMenuOpen, labelUserLogged, selectedLanguage, currentLanguage, texts]);

  return (
    <>
      <div className={headerClassList} data-testid='tecma-header' {...rest}>
        <div className='header-content'>
          <div className='header-left' />
          <div className='header-right'>
            {renderHeaderActions}
            {renderSettingsComponent}
            {renderSettingsComponent && <div className='header-divider' aria-hidden />}
            {renderUserComponent}
          </div>
        </div>
      </div>
      <Snackbar
        open={isSnackbarOpen}
        handleClose={() => setIsSnackbarOpen(false)}
        title={messageCopiedTranslated || 'Element copied to clipboard'}
        type='success'
        hideDuration={3000}
      />
    </>
  );
};

export default TecmaHeader;
