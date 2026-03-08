import React, { FC, ReactElement, useState, useMemo, useEffect, useCallback } from 'react';
import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { Icon, IconURLContext } from '../Icon';
import { IconName } from '../Icon/IconName';
import { Drawer } from '../Drawer';
import { TecmaSidebarNavigationItem } from '../TecmaSidebar/TecmaSidebar';

import '../../styles/tecmaSidebarMobile.scss';

export interface TecmaSidebarMobileItem {
  iconName: IconName;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  opensDrawer?: boolean;
  subItems?: TecmaSidebarNavigationItem[];
}

interface TecmaSidebarMobileRequiredProps {
  items: TecmaSidebarMobileItem[];
}

interface TecmaSidebarMobileOptionalProps extends DefaultProps {
  className?: string;
}

export interface TecmaSidebarMobileProps extends TecmaSidebarMobileRequiredProps, TecmaSidebarMobileOptionalProps {}

const defaultProps: TecmaSidebarMobileOptionalProps = {
  'data-testid': 'tecma-sidebar-mobile',
};

const TecmaSidebarMobile: FC<TecmaSidebarMobileProps> = ({
  items,
  className,
  ...rest
}): ReactElement => {
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  const [isNestedDrawerOpen, setIsNestedDrawerOpen] = useState(false);
  const [nestedDrawerItems, setNestedDrawerItems] = useState<TecmaSidebarNavigationItem[]>([]);
  const [nestedDrawerTitle, setNestedDrawerTitle] = useState('');
  const [activeItemLabel, setActiveItemLabel] = useState<string>('');
  const [lastActiveItemLabel, setLastActiveItemLabel] = useState<string>('');

  // Initialize activeItemLabel from items props (when an item has isActive: true)
  const getActiveLabelFromItems = useCallback(() => {
    // Check visible items first
    const visibleItems = items.slice(0, 3);
    const activeVisibleItem = visibleItems.find((item) => {
      if (item.isActive) {
        return true;
      }
      // Check subItems if present
      return item.subItems?.some((subItem) => subItem.isActive);
    });
    
    if (activeVisibleItem) {
      return activeVisibleItem.label;
    }

    // Check hidden items (in drawer)
    // If an item in the drawer is active, "More" should be active
    const hiddenItems = items.slice(3);
    const activeHiddenItem = hiddenItems.find((item) => {
      if (item.isActive) {
        return true;
      }
      return item.subItems?.some((subItem) => subItem.isActive);
    });

    // If an item in the drawer is active, return "More" instead of the item label
    return activeHiddenItem ? 'More' : '';
  }, [items]);

  // Initialize activeItemLabel from props on mount and when items change
  useEffect(() => {
    const activeLabel = getActiveLabelFromItems();
    setActiveItemLabel(activeLabel || '');
  }, [getActiveLabelFromItems]);

  const sidebarClassList = classNames('tecma-sidebar-mobile', className);

  // Split items: first 3 visible, 4th is "More" button, rest go to drawer
  const visibleItems = useMemo(() => items.slice(0, 3), [items]);
  const hiddenItems = useMemo(() => items.slice(3), [items]); // Skip 4th item (More button)

  // Create "More" button that opens drawer
  const moreItem: TecmaSidebarMobileItem = useMemo(() => ({
    label: 'More',
    iconName: 'menu' as IconName,
    onClick: () => {},
    opensDrawer: true,
  }), []);

  // Convert hidden items to TecmaSidebarNavigationItem format for drawer
  const drawerItems = useMemo<TecmaSidebarNavigationItem[]>(() => {
    return hiddenItems.map((item) => ({
      iconName: item.iconName,
      label: item.label,
      onClick: item.onClick,
      isActive: item.isActive,
      subItems: item.subItems,
    }));
  }, [hiddenItems]);

  // Enhanced items with proper active state management (first 3 + More button)
  // Consider both activeItemLabel (internal state) and item.isActive (from props)
  const enhancedItems = useMemo(() => {
    const itemsWithMore = [...visibleItems, moreItem];
    return itemsWithMore.map((item) => ({
      ...item,
      isActive: item.isActive || item.label === activeItemLabel || (item.opensDrawer && isMoreDrawerOpen),
    }));
  }, [visibleItems, moreItem, activeItemLabel, isMoreDrawerOpen]);

  const handleDrawerItemClick = (item: TecmaSidebarMobileItem) => {
    // Save the current active item (if not "More") before switching to "More"
    if (activeItemLabel && activeItemLabel !== 'More') {
      setLastActiveItemLabel(activeItemLabel);
    }
    setActiveItemLabel(item.label);
    setIsMoreDrawerOpen(true);
  };

  const handleItemClick = (item: TecmaSidebarMobileItem) => {
    setActiveItemLabel(item.label);
    setLastActiveItemLabel(item.label);
    setIsMoreDrawerOpen(false);
    setIsNestedDrawerOpen(false);
    item.onClick();
  };

  const handleSidebarItemClick = (item: TecmaSidebarNavigationItem) => {
    if (item.subItems && item.subItems.length > 0) {
      setNestedDrawerItems(item.subItems);
      setNestedDrawerTitle(item.label);
      setIsNestedDrawerOpen(true);
    } else {
      item.onClick();
      setIsMoreDrawerOpen(false);
    }
  };

  const handleNestedItemClick = (item: TecmaSidebarNavigationItem) => {
    item.onClick();
    setIsNestedDrawerOpen(false);
    setIsMoreDrawerOpen(false);
  };

  const handleCloseMoreDrawer = () => {
    setIsMoreDrawerOpen(false);
    // Restore the last active item when closing the drawer
    if (lastActiveItemLabel) {
      setActiveItemLabel(lastActiveItemLabel);
    } else {
      setActiveItemLabel('');
    }
  };

  const renderMoreDrawer = useMemo(() => {

    return (
      <Drawer
        hideBackdrop
        open={isMoreDrawerOpen}
        onClose={handleCloseMoreDrawer}
        anchor="right"
        className="tecma-sidebar-mobile-drawer"
      >
        <Drawer.Header onClose={handleCloseMoreDrawer} />
        <Drawer.Content>
          {drawerItems.map((item, index) => (
            <Drawer.Item
              key={`drawer-item-${index}`}
              iconName={item.iconName}
              label={item.label}
              rightIcon={item.subItems && item.subItems.length > 0 ? 'chevron-right' : undefined}
              onClick={() => handleSidebarItemClick(item)}
            />
          ))}
        </Drawer.Content>
      </Drawer>
    );
  }, [drawerItems, isMoreDrawerOpen]);

  const renderNestedDrawer = useMemo(() => {
    if (!nestedDrawerItems.length) return null;

    return (
      <Drawer
        hideBackdrop
        open={isNestedDrawerOpen}
        onClose={() => setIsNestedDrawerOpen(false)}
        anchor="right"
        className="tecma-sidebar-mobile-drawer"
      >
        <Drawer.Header 
          isNestedHeader 
          onClose={() => setIsNestedDrawerOpen(false)} 
          label={nestedDrawerTitle} 
        />
        <Drawer.Content>
          {nestedDrawerItems.map((item, index) => (
            <Drawer.Item
              key={`nested-item-${index}`}
              iconName={item.iconName}
              label={item.label}
              onClick={() => handleNestedItemClick(item)}
            />
          ))}
        </Drawer.Content>
      </Drawer>
    );
  }, [nestedDrawerItems, isNestedDrawerOpen, nestedDrawerTitle]);

  return (
    <IconURLContext.Provider value="/ds-icons">
      <div className={sidebarClassList} {...rest}>
        <div className="tecma-sidebar-mobile-content">
          {enhancedItems.map((item, index) => (
            <button
              key={`sidebar-mobile-item-${index}`}
              className={classNames('tecma-sidebar-mobile-item', {
                'tecma-sidebar-mobile-item--active': item.isActive,
              })}
              onClick={item.opensDrawer ? () => handleDrawerItemClick(item) : () => handleItemClick(item)}
              type="button"
            >
              <div className="tecma-sidebar-mobile-item-icon">
                <Icon iconName={item.iconName} />
              </div>
              <span className="tecma-sidebar-mobile-item-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {renderMoreDrawer}
      {renderNestedDrawer}
    </IconURLContext.Provider>
  );
};

TecmaSidebarMobile.defaultProps = defaultProps;

export default TecmaSidebarMobile;
