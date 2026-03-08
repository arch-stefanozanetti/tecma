import React, { useState, useMemo } from 'react';
import { Story, Meta } from '@storybook/react';
import TecmaSidebar, { TecmaSidebarProps, TecmaSidebarNavigationItem } from '../components/TecmaSidebar/TecmaSidebar';
import TecmaHeader, { DropdownItem, UserDropdownProps, TecmaHeaderTexts } from '../components/TecmaHeader/TecmaHeader';
import { IconName } from '../components/Icon/IconName';

const Template: Story<TecmaSidebarProps> = (args) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState<{ parent: number; sub: number | null }>({ parent: 0, sub: null });
  const [expandedDropdowns, setExpandedDropdowns] = useState<Set<number>>(new Set());

  const handleItemClick = (parentIndex: number, subIndex: number | null) => {
    setActiveItem({ parent: parentIndex, sub: subIndex });
    if (isCollapsed) {
      setIsCollapsed(false);
    }
  };

  const handleToggleDropdown = (index: number) => {
    setExpandedDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleCloseDropdown = (index: number) => {
    setExpandedDropdowns(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const enhancedItems = args.items.map((item, parentIndex) => {
    const hasSub = !!item.subItems?.length;
    const isParentActive = activeItem.parent === parentIndex;
    const activeSubIndex = isParentActive ? activeItem.sub : null;
    const activeSubItem = activeSubIndex !== null ? item.subItems?.[activeSubIndex] : null;

    const subItems = hasSub
      ? item.subItems?.map((subItem, subIndex) => ({
        ...subItem,
        isActive: isParentActive && activeSubIndex === subIndex,
        onClick: () => handleItemClick(parentIndex, subIndex),
      }))
      : undefined;

    return {
      ...item,
      isActive: isParentActive && activeSubIndex === null,
      hasSubItems: hasSub,
      subItems: subItems,
      onClick: () => handleItemClick(parentIndex, null),
      activeSubLabel: activeSubItem?.label,
      isExpanded: expandedDropdowns.has(parentIndex),
      onToggle: () => handleToggleDropdown(parentIndex),
      onCloseDropdown: () => handleCloseDropdown(parentIndex),
    };
  });

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <TecmaSidebar
        {...args}
        items={enhancedItems}
        defaultCollapsed={isCollapsed}
      />
      <div style={{ flex: 1, padding: '20px' }}>
        <h1>Content Area</h1>
        <p>Active Item: {args.items[activeItem.parent]?.label} {activeItem.sub !== null ? `> ${args.items[activeItem.parent]?.subItems?.[activeItem.sub]?.label}` : ''}</p>
      </div>
    </div>
  );
};

export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
Basic.args = {
  items: [
    { label: 'Dashboard', iconName: 'home' as IconName, onClick: () => console.log('Dashboard clicked') },
    { label: 'Analytics superlunghissimastringapertest', iconName: 'chart-bar' as IconName, onClick: () => console.log('Analytics clicked') },
  ],
};

export const WithSubItems = Template.bind({});
WithSubItems.storyName = 'With Sub Items';
WithSubItems.args = {
  items: [
    { label: 'Dashboard', iconName: 'home' as IconName, onClick: () => console.log('Dashboard clicked') },
    { label: 'Dashboard', iconName: 'home' as IconName, onClick: () => console.log('Dashboard clicked') },
    { label: 'Dashboard', iconName: 'home' as IconName, onClick: () => console.log('Dashboard clicked') },
    { label: 'Dashboard', iconName: 'home' as IconName, onClick: () => console.log('Dashboard clicked') },
    { 
      label: 'Sales', 
      iconName: 'chart-bar' as IconName, 
      onClick: () => console.log('Sales clicked'),
      hasSubItems: true,
      subItems: [
        { label: 'Quotes', onClick: () => console.log('Quotes clicked') },
        { label: 'Proposals', onClick: () => console.log('Proposals clicked') },
        { label: 'Contracts', onClick: () => console.log('Contracts clicked') },
      ]
    },
    { 
      label: 'Andamento vendite', 
      iconName: 'chart-bar' as IconName, 
      onClick: () => console.log('Sales clicked'),
      hasSubItems: true,
      subItems: [
        { label: 'Quotes', onClick: () => console.log('Quotes clicked') },
        { label: 'Proposals', onClick: () => console.log('Proposals clicked') },
        { label: 'Home configurations', onClick: () => console.log('Contracts clicked') },
      ]
    },
    { label: 'Settings', iconName: 'cog' as IconName, onClick: () => console.log('Settings clicked') },
  ],
};

export const WithDividers = Template.bind({});
WithDividers.storyName = 'With Dividers';
WithDividers.args = {
  items: [
    { label: 'Dashboard', iconName: 'home' as IconName, onClick: () => console.log('Dashboard clicked') },
    { label: 'Analytics', iconName: 'chart-bar' as IconName, onClick: () => console.log('Analytics clicked') },
    { label: 'Reports', iconName: 'chart-line' as IconName, onClick: () => console.log('Reports clicked'), useDivider: true },
    { label: 'Settings', iconName: 'cog' as IconName, onClick: () => console.log('Settings clicked') },
    { label: 'Profile', iconName: 'user' as IconName, onClick: () => console.log('Profile clicked') },
  ],
};

export const Collapsed = Template.bind({});
Collapsed.storyName = 'Collapsed State';
Collapsed.args = {
  items: [
    { label: 'Dashboard', iconName: 'home' as IconName, onClick: () => console.log('Dashboard clicked') },
    { label: 'Analytics', iconName: 'chart-bar' as IconName, onClick: () => console.log('Analytics clicked') },
    { label: 'Settings', iconName: 'cog' as IconName, onClick: () => console.log('Settings clicked') },
  ],
  defaultCollapsed: true,
};

export const WithFooter = Template.bind({});
WithFooter.storyName = 'With Footer';
WithFooter.args = {
  items: [
    { label: 'Dashboard', iconName: 'home' as IconName, onClick: () => console.log('Dashboard clicked') },
    { label: 'Analytics', iconName: 'chart-bar' as IconName, onClick: () => console.log('Analytics clicked') },
    { label: 'Settings', iconName: 'cog' as IconName, onClick: () => console.log('Settings clicked') },
  ],
};

const TemplateWithExpandedSubItems: Story<TecmaSidebarProps> = (args) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState<{ parent: number; sub: number | null }>({ parent: 0, sub: null });
  const [expandedDropdowns, setExpandedDropdowns] = useState<Set<number>>(new Set([0, 2]));

  const handleItemClick = (parentIndex: number, subIndex: number | null) => {
    setActiveItem({ parent: parentIndex, sub: subIndex });
    if (isCollapsed) {
      setIsCollapsed(false);
    }
  };

  const handleToggleDropdown = (index: number) => {
    setExpandedDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleCloseDropdown = (index: number) => {
    setExpandedDropdowns(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const enhancedItems = args.items.map((item, parentIndex) => {
    const hasSub = !!item.subItems?.length;
    const isParentActive = activeItem.parent === parentIndex;
    const activeSubIndex = isParentActive ? activeItem.sub : null;
    const activeSubItem = activeSubIndex !== null ? item.subItems?.[activeSubIndex] : null;

    const subItems = hasSub
      ? item.subItems?.map((subItem, subIndex) => ({
        ...subItem,
        isActive: isParentActive && activeSubIndex === subIndex,
        onClick: () => handleItemClick(parentIndex, subIndex),
      }))
      : undefined;

    return {
      ...item,
      isActive: isParentActive && activeSubIndex === null,
      hasSubItems: hasSub,
      subItems: subItems,
      onClick: () => handleItemClick(parentIndex, null),
      activeSubLabel: activeSubItem?.label,
      isExpanded: expandedDropdowns.has(parentIndex),
      onToggle: () => handleToggleDropdown(parentIndex),
      onCloseDropdown: () => handleCloseDropdown(parentIndex),
    };
  });

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <TecmaSidebar
        {...args}
        items={enhancedItems}
        defaultCollapsed={isCollapsed}
      />
      <div style={{ flex: 1, padding: '20px' }}>
        <h1>Content Area</h1>
        <p>Active Item: {args.items[activeItem.parent]?.label} {activeItem.sub !== null ? `> ${args.items[activeItem.parent]?.subItems?.[activeItem.sub]?.label}` : ''}</p>
      </div>
    </div>
  );
};

export const SubItemsExpanded = TemplateWithExpandedSubItems.bind({});
SubItemsExpanded.storyName = 'Sub Items Expanded';
SubItemsExpanded.args = {
  items: [
    { 
      label: 'Dashboard', 
      iconName: 'home' as IconName, 
      onClick: () => console.log('Dashboard clicked'),
      hasSubItems: true,
      subItems: [
        { label: 'Overview', onClick: () => console.log('Overview clicked') },
        { label: 'Statistics', onClick: () => console.log('Statistics clicked') },
        { label: 'Reports', onClick: () => console.log('Reports clicked') },
      ]
    },
    { 
      label: 'Sales', 
      iconName: 'chart-bar' as IconName, 
      onClick: () => console.log('Sales clicked'),
      hasSubItems: true,
      subItems: [
        { label: 'Quotes', onClick: () => console.log('Quotes clicked') },
        { label: 'Proposals', onClick: () => console.log('Proposals clicked') },
        { label: 'Contracts', onClick: () => console.log('Contracts clicked') },
        { label: 'Invoices', onClick: () => console.log('Invoices clicked') },
      ]
    },
    { 
      label: 'Products', 
      iconName: 'box' as IconName, 
      onClick: () => console.log('Products clicked'),
      hasSubItems: true,
      subItems: [
        { label: 'Catalog', onClick: () => console.log('Catalog clicked') },
        { label: 'Categories', onClick: () => console.log('Categories clicked') },
        { label: 'Inventory', onClick: () => console.log('Inventory clicked') },
      ]
    },
    { label: 'Settings', iconName: 'cog' as IconName, onClick: () => console.log('Settings clicked') },
  ],
};

const TemplateWithHeader: Story<TecmaSidebarProps> = () => {
  const [currentPage, setCurrentPage] = useState<'appartamenti' | 'account-manager' | null>('appartamenti');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedDropdowns, setExpandedDropdowns] = useState<Set<number>>(new Set());

  const sidebarItems: TecmaSidebarNavigationItem[] = useMemo(() => [
    { 
      label: 'Appartamenti', 
      iconName: 'home' as IconName, 
      onClick: () => {
        setCurrentPage('appartamenti');
        console.log('Appartamenti clicked');
      },
      isActive: currentPage === 'appartamenti',
    },
    { 
      label: 'Clienti', 
      iconName: 'user' as IconName, 
      onClick: () => {
        setCurrentPage('appartamenti');
        console.log('Clienti clicked');
      },
      isActive: false,
    },
    { 
      label: 'Contratti', 
      iconName: 'file' as IconName, 
      onClick: () => {
        setCurrentPage('appartamenti');
        console.log('Contratti clicked');
      },
      isActive: false,
    },
  ], [currentPage]);

  const handleToggleDropdown = (index: number) => {
    setExpandedDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleCloseDropdown = (index: number) => {
    setExpandedDropdowns(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const enhancedItems = useMemo(() => sidebarItems.map((item, parentIndex) => {
    const hasSub = !!item.subItems?.length;
    const isParentActive = item.isActive ?? false;
    const activeSubIndex = isParentActive ? null : null;
    const activeSubItem = activeSubIndex !== null ? item.subItems?.[activeSubIndex] : null;

    const enhancedSubItems = hasSub
      ? item.subItems?.map((subItem, subIndex) => ({
          ...subItem,
          isActive: isParentActive && activeSubIndex === subIndex,
          onClick: () => {
            subItem.onClick();
          },
        }))
      : undefined;

    return {
      ...item,
      isActive: isParentActive,
      hasSubItems: hasSub,
      subItems: enhancedSubItems,
      onClick: () => {
        item.onClick();
      },
      activeSubLabel: activeSubItem?.label,
      isExpanded: expandedDropdowns.has(parentIndex),
      onToggle: () => handleToggleDropdown(parentIndex),
      onCloseDropdown: () => handleCloseDropdown(parentIndex),
    };
  }), [sidebarItems, expandedDropdowns]);

  const settingsDropdownItems: DropdownItem[] = [
    { 
      isVisible: true, 
      iconName: 'user' as IconName, 
      label: 'Account Manager', 
      onClick: () => {
        setCurrentPage('account-manager');
        console.log('Account Manager clicked - navigating to external page');
      } 
    },
    { 
      isVisible: true, 
      iconName: 'cog' as IconName, 
      label: 'Preferences', 
      onClick: () => {
        setCurrentPage('account-manager');
        console.log('Preferences clicked - navigating to external page');
      } 
    },
  ];

  const userDropdown: UserDropdownProps = {
    userLogged: 'Mario Rossi',
    phone: '3343304569',
    email: 'm.rossi@email.com',
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
    logoutLabel: 'Logout',
    onLogout: () => console.log('Logout'),
  };

  const texts: TecmaHeaderTexts = {
    settingsLabel: 'Settings',
    backLabel: 'Back',
    languageLabel: 'Language',
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TecmaHeader
        labelUserLogged="Mario Rossi"
        settingsDropdownItems={settingsDropdownItems}
        userDropdown={userDropdown}
        selectedLanguage="en-UK"
        texts={texts}
      />
      <div style={{ display: 'flex', flex: 1, marginTop: '80px' }}>
        <TecmaSidebar
          items={enhancedItems}
          defaultCollapsed={isCollapsed}
        />
        <div style={{ flex: 1, padding: '20px' }}>
          <h1>Content Area</h1>
          {currentPage === 'appartamenti' && (
            <div>
              <p><strong>Pagina: Appartamenti</strong></p>
              <p>Questa è una pagina raggiungibile dalla sidebar.</p>
              <p>L'elemento "Appartamenti" nella sidebar dovrebbe essere attivo.</p>
            </div>
          )}
          {currentPage === 'account-manager' && (
            <div>
              <p><strong>Pagina: Account Manager</strong></p>
              <p>Questa è una pagina esterna (raggiungibile dai settings dell'header).</p>
              <p><strong>Nessun elemento della sidebar dovrebbe essere attivo ora.</strong></p>
              <p style={{ marginTop: '20px' }}>
                <button 
                  onClick={() => setCurrentPage('appartamenti')}
                  style={{ padding: '10px 20px', cursor: 'pointer' }}
                >
                  Torna a Appartamenti
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const WithHeaderInteraction = TemplateWithHeader.bind({});
WithHeaderInteraction.storyName = 'With Header Interaction (Test Reset)';
WithHeaderInteraction.parameters = {
  docs: {
    description: {
      story: 'Questa story testa il comportamento descritto: quando si naviga a una pagina esterna tramite i settings dell\'header (es. Account Manager), la sidebar dovrebbe resettarsi e nessun elemento dovrebbe rimanere attivo. Inizia dalla pagina "Appartamenti" (elemento attivo nella sidebar), poi apri Settings > Account Manager per vedere la sidebar resettarsi.',
    },
  },
};

export default {
  title: 'Components/TecmaSidebar',
  component: TecmaSidebar,
  parameters: {
    componentSubtitle: 'TecmaSidebar component for application navigation.',
  },
  argTypes: {
    items: {
      description: 'Array of navigation items',
      control: 'object',
    },
    logoComponent: {
      description: 'Custom component for the sidebar logo',
      control: 'object',
    },
    footerComponent: {
      description: 'Custom component for the sidebar footer',
      control: 'object',
    },
    showCollapseButton: {
      description: 'Whether to show the collapse button',
      control: 'boolean',
    },
    defaultCollapsed: {
      description: 'Whether the sidebar starts collapsed',
      control: 'boolean',
    },
  },
} as Meta<typeof TecmaSidebar>;
