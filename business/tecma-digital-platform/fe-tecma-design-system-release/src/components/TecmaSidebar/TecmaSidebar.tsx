import React, { useCallback, useEffect, useMemo, useState, FC, ReactElement } from 'react';
import classNames from 'classnames';

import { Button } from '../Button';
import { Icon, IconURLContext } from '../Icon';
import { NavigationItem } from '../NavigationItem';
import { DefaultProps } from '../../declarations/defaultProps';
import { IconName } from '../Icon/IconName';

import '../../styles/tecmaSidebar.scss';
import { ButtonBase, Tooltip } from '@mui/material';
import { colors } from '../../constants/styles';
import TecmaLogo from '../../components/TecmaLogo/TecmaLogo';
import TecmaSidebarFooter from '../../components/TecmaSidebarFooter/TecmaSidebarFooter';

export interface TecmaSidebarNavigationItem {
  iconName?: IconName;
  label: string;
  onClick: () => void;
  useDivider?: boolean;
  isActive?: boolean;
  hasSubItems?: boolean;
  subItems?: TecmaSidebarNavigationItem[];
}

interface TecmaSidebarRequiredProps {
  items: TecmaSidebarNavigationItem[];
}

interface TecmaSidebarOptionalProps extends DefaultProps {
  defaultCollapsed?: boolean;
  logo?: string | React.ReactNode;
}

export interface TecmaSidebarProps extends TecmaSidebarRequiredProps, TecmaSidebarOptionalProps {}

const defaultProps: TecmaSidebarOptionalProps = {
  'data-testid': 'tecma-sidebar',
  defaultCollapsed: false,
};

const TecmaSidebar: FC<TecmaSidebarProps> = ({
  items,
  defaultCollapsed,
  className,
  logo,
  ...rest
}): ReactElement => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isExpandMenuTooltipDisabled, setIsExpandMenuTooltipDisabled] = useState(!isCollapsed);
  const [expandedDropdowns, setExpandedDropdowns] = useState<Set<number>>(new Set());

  // track a single active item at a time: either a top-level item (sub === null)
  // or a specific sub-item (sub === index)
  // parent: -1 means no active item
  const getActiveFromItems = useCallback(() => {
    let parentIndex: number | null = null;
    let subIndex: number | null = null;
    items.forEach((item, i) => {
      if (item.isActive && parentIndex === null) {
        parentIndex = i;
        subIndex = null;
      }
      if (item.subItems) {
        item.subItems.forEach((sub, j) => {
          if (sub.isActive) {
            parentIndex = i;
            subIndex = j;
          }
        });
      }
    });
    return { parent: parentIndex ?? -1, sub: subIndex } as { parent: number; sub: number | null };
  }, [items]);
  
  const [active, setActive] = useState<{ parent: number; sub: number | null }>(getActiveFromItems());

  // Update active state when items prop changes (e.g., when navigating to external pages)
  useEffect(() => {
    const newActive = getActiveFromItems();
    setActive(newActive);
  }, [getActiveFromItems]);

  
  const handlePageChange = () => setIsCollapsed((el) => !el);

  // functions to handle the dropdown
  const handleDropdownToggle = useCallback((index: number) => {
    setExpandedDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const handleDropdownClose = useCallback((index: number) => {
    setExpandedDropdowns(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsExpandMenuTooltipDisabled(!isCollapsed);
    }, 200);
    return () => {
      clearTimeout(timeout);
    }
  }, [isCollapsed]);

  // close all the dropdowns when the sidebar is collapsed
  useEffect(() => {
    if (isCollapsed) {
      setExpandedDropdowns(new Set());
    }
  }, [isCollapsed]);

  const Footer = useMemo(() => {
    return (
      <div className="sidebar-wrapper-footer">
        <div className="sidebar-footer">
          <TecmaSidebarFooter />
        </div>
      </div>
    );
  }, []);

  const NavigationItems = useMemo(() => {
    return items.map((item, index) => {
      const hasSub = !!item.subItems?.length;
      const isParentActive = active.parent === index;
      const activeSubIndex = isParentActive ? active.sub : null;
      const activeSubItem = activeSubIndex !== null ? item.subItems?.[activeSubIndex] : null;

      const enhancedSubItems = hasSub
        ? item.subItems?.map((subItem, subIndex) => ({
          ...subItem,
          isActive: isParentActive && activeSubIndex === subIndex,
          onClick: () => {
            setActive({ parent: index, sub: subIndex });
            subItem.onClick(); // Call the original onClick
          },
        }))
        : undefined;

      const { useDivider, ...itemWithoutDivider } = item;

      const enhancedItem = {
        ...itemWithoutDivider,
        // the element is active if it is the parent active (with sub-item or without)
        isActive: isParentActive,
        hasSubItems: hasSub,
        subItems: enhancedSubItems,
        onClick: () => {
          setActive({ parent: index, sub: null });
          item.onClick(); // Call the original onClick
        },
        // add the active sub-item label if it exists
        activeSubLabel: activeSubItem?.label,
        // handle dropdown
        isExpanded: expandedDropdowns.has(index),
        onToggle: () => handleDropdownToggle(index),
        onCloseDropdown: () => handleDropdownClose(index),
      };

      const nav = (
        <NavigationItem
          className={classNames('sidebar-padding', { collapsed: isCollapsed })}
          buttonStyle={{ 
            width: '100%', 
            display: 'flex'
          }}
          labelColor={colors.primary['$on-primary-sub-sidebar']} 
          iconColor={colors.primary['$on-primary-sub-sidebar']} 
          isCollapsed={isCollapsed}
          onExpandSidebar={() => setIsCollapsed(false)}
          {...enhancedItem}
        />
      );

      return (
        <React.Fragment key={`sidebar-item-${index}-${item.label}`}>
          {isCollapsed && !hasSub ? (
            <Tooltip title={item.label} placement="right" classes={{ tooltip: "sidebar-item-tooltip" }}>
              <div>{nav}</div>
            </Tooltip>
          ) : (
            nav
          )}
          {useDivider && <div className="sidebar-divider" />}
        </React.Fragment>
      );
    });
  }, [items, active.parent, active.sub, expandedDropdowns, isCollapsed, handleDropdownToggle, handleDropdownClose]);

  const sidebarClassList = classNames('sidebar', { collapsed: isCollapsed }, className);

  const renderLogo = () => {
    if (logo) {
      if (typeof logo === 'string') {
        return <img src={logo} alt="Logo" className="sidebar-logo-image" />;
      }
      return logo;
    }
    return <TecmaLogo />;
  };

  return (
    <IconURLContext.Provider value="/ds-icons">
      <div className={sidebarClassList} {...rest}>
        <div className="sidebar-logo">
          {renderLogo()}
        </div>
        <div className="sidebar-menu">
        <Tooltip
          disableFocusListener
          disableTouchListener
          disableHoverListener={isExpandMenuTooltipDisabled}
          title={"Expand Menu"}
          placement="right"
        >
          <ButtonBase disableRipple className="sidebar-collapse-button" onClick={handlePageChange}>
            <IconURLContext.Provider value="/ds-icons">
              <Icon className="sidebar-collapse-button-icon" iconName={isCollapsed ? "expand" : "contract"} />
            </IconURLContext.Provider>
          </ButtonBase>
        </Tooltip>
      </div>
        <div className={classNames('sidebar-items-container', { scrollable: items?.length >= 5 })}>
          <div className="sidebar-items">{NavigationItems}</div>
        </div>
        {Footer}
      </div>
    </IconURLContext.Provider>
  );
};

TecmaSidebar.defaultProps = defaultProps;

export default TecmaSidebar;
