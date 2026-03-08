import React, { useState, useEffect, useCallback, useMemo, useRef, FC, ReactElement } from 'react';
import classNames from 'classnames';

import { Button } from '../Button';
import { DefaultProps } from '../../declarations/defaultProps';
import { IconName } from '../Icon/IconName';

import '../../styles/navigationItem.scss';
import { Icon, IconURLContext } from '../Icon';
import { colors } from '../../constants/styles';


interface NavigationItemRequiredProps {
  label: string;
  onClick: () => void;
}

interface NavigationItemOptionalProps extends DefaultProps {
  iconName?: IconName;
  isActive?: boolean;
  containerStyle?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  // color props
  labelColor?: string;
  iconColor?: string;
  // dropdown props
  hasSubItems?: boolean;
  subItems?: NavigationItemProps[];
  isExpanded?: boolean;
  onToggle?: () => void;
  // active sub-item label
  activeSubLabel?: string;
  // collapsed state
  isCollapsed?: boolean;
  // function to expand sidebar when collapsed
  onExpandSidebar?: () => void;
  // function to close dropdown when sidebar collapses
  onCloseDropdown?: () => void;
  // optional hover handlers passthrough
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export interface NavigationItemProps extends NavigationItemRequiredProps, NavigationItemOptionalProps {}

const defaultProps: NavigationItemOptionalProps = {
  'data-testid': 'tecma-navigation-item',
  isActive: false,
  hasSubItems: false,
  subItems: [],
  isCollapsed: false,
  labelColor: '#383B48',
  iconColor: '#383B48',
};

const NavigationItem: FC<NavigationItemProps> = ({
  iconName,
  label,
  onClick,
  isActive = false,
  className = '',
  containerStyle,
  buttonStyle,
  labelColor = '#383B48',
  iconColor = '#383B48',
  hasSubItems = false,
  subItems = [],
  isExpanded: externalIsExpanded,
  onToggle,
  activeSubLabel,
  isCollapsed = false,
  onExpandSidebar,
  onCloseDropdown,
  ...rest
}): ReactElement => {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState<number>(0);
  const [flyoutLeft, setFlyoutLeft] = useState<number>(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  
  // close dropdown when sidebar collapses
  useEffect(() => {
    if (isCollapsed && isExpanded && onCloseDropdown) {
      onCloseDropdown();
    }
  }, [isCollapsed, isExpanded, onCloseDropdown]);

  // cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleToggle = useCallback(() => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalIsExpanded(!internalIsExpanded);
    }
  }, [onToggle, internalIsExpanded]);

  const handleClick = useCallback(() => {
    if (hasSubItems) {
      // if the sidebar is collapsed and I click on a dropdown, expand the sidebar
      if (isCollapsed && onExpandSidebar) {
        onExpandSidebar();
        // open the dropdown after expanding the sidebar
        timeoutRef.current = setTimeout(() => {
          handleToggle();
        }, 100); // small delay to allow the sidebar animation
        return;
      }
      // otherwise handle the normal toggle
      handleToggle();
    } else {
      onClick();
    }
  }, [handleToggle, hasSubItems, isCollapsed, onClick, onExpandSidebar]);

  const handleMouseEnter = useCallback(() => {
    if (hoverHideTimeoutRef.current) {
      clearTimeout(hoverHideTimeoutRef.current);
      hoverHideTimeoutRef.current = null;
    }
    if (isCollapsed && hasSubItems) {
      // get the position of the wrapper
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setFlyoutTop(rect.top - 48);
        setFlyoutLeft(rect.right + 8);
      }
      setIsHovered(true);
    }
  }, [isCollapsed, hasSubItems]);

  const handleMouseLeave = useCallback(() => {
    if (isCollapsed && hasSubItems) {
      // add small delay to allow cursor to reach flyout without closing
      hoverHideTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 150);
    }
  }, [isCollapsed, hasSubItems]);

  // if there is an activeSubLabel, close the dropdown automatically
  const shouldShowSubLabel = useMemo(() => activeSubLabel && !isExpanded && !isCollapsed, [activeSubLabel, isExpanded, isCollapsed]);

  // the element is active if it is active and (has no sub-items or is not expanded)
  const isActuallyActive = useMemo(() => isActive && (!hasSubItems || !isExpanded), [isActive, hasSubItems, isExpanded]);

  const wrapperClassList = classNames('navigation-item-wrapper', { collapsed: isCollapsed });
  const boxClassList = classNames('box-navigation-item', { active: isActuallyActive, collapsed: isCollapsed });
  const buttonClassList = classNames('navigation-item', { collapsed: isCollapsed }, className);
  const subItemsClassList = classNames('sub-items-container', { expanded: isExpanded });

  const subItemsHoveredCollapsed = useMemo(() => {
    if (!(isCollapsed && hasSubItems && isHovered)) return null;
    const activeColor = colors.primary['$accent'] || '#5b5bd6';
    return (
      <div
        className="subitem-collapsed-hovered"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ position: 'fixed', top: flyoutTop, left: flyoutLeft, zIndex: 1000 }}
      >
        {(subItems || []).map((subItem, idx) => (
          <div
            className="subitem-collapsed-hovered-item"
            key={`collapsed-sub-${idx}`}
            onClick={() => {
              subItem.onClick();
              setIsHovered(false);
            }}
            style={{
              color: subItem.isActive ? activeColor : colors.secondary['$on-secondary-light'],
            }}
          >
            {subItem.label}
          </div>
        ))}
      </div>
    );
  }, [isCollapsed, hasSubItems, isHovered, subItems, handleMouseEnter, handleMouseLeave, flyoutTop, flyoutLeft]);

  return (
    <IconURLContext.Provider value="/ds-icons">
      <div ref={wrapperRef} className={wrapperClassList} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <div className={boxClassList} style={containerStyle} data-testid="box-navigation-item">
          <Button
            outlined
            iconName={iconName}
            onClick={handleClick}
            className={buttonClassList}
            style={{
              ...buttonStyle,
              // color applied to button so the leading icon inherits it
              ...(iconColor ? { color: iconColor } : {}),
            }}
            {...rest}
          >
            <div className="button-content">
              {!isCollapsed && (
                <div
                  className="main-label"
                  style={labelColor ? { color: labelColor } : undefined}
                >
                  {label}
                </div>
              )}
              {shouldShowSubLabel && <div className="sub-label">{activeSubLabel}</div>}
            </div>
            {hasSubItems && !isCollapsed && (
              <Icon
                iconName={isCollapsed ? 'chevron-right' : 'chevron-down'}
                className={classNames('dropdown-arrow', { expanded: isExpanded })}
              />
            )}
          </Button>
          {isActuallyActive && <div className="box-navigation-item-indicator" />}
        </div>
        {hasSubItems && !isCollapsed && (
          <div className={subItemsClassList}>
            {subItems?.map((subItem, index) => (
              <NavigationItem
                key={`sub-item-${index}`}
                {...subItem}
                className={classNames('sub-item', { active: subItem.isActive })}
                isCollapsed={isCollapsed}
                onExpandSidebar={onExpandSidebar}
                onCloseDropdown={onCloseDropdown}
              />
            ))}
          </div>
        )}
      </div>
      {subItemsHoveredCollapsed}
    </IconURLContext.Provider>
  );
};

NavigationItem.defaultProps = defaultProps;

export default NavigationItem;