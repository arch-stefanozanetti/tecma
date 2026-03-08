import React, { useState, useRef, useCallback, ChangeEvent, KeyboardEvent, forwardRef } from 'react';
import classNames from 'classnames';
import { PopoverOrigin } from '@mui/material/Popover';

import { utilityThrottle } from '../../helpers/throttle';
import { useDebounce } from '../../hooks/useDebounce';
import { PaginatedItemsParams, usePaginatedSingleItems } from '../../hooks/usePaginatedSingle';
import { useDevice } from '../../hooks/useDevice';
import { Icon } from '../Icon';
import { IconName } from '../Icon/IconName';
import { Input } from '../Input';
import { Spinner } from '../Spinner';
import { Tooltip } from '../Tooltip';
import { Modal } from '../Modal';
import { Popover } from '../Popover';

import '../../styles/selectDynamic.scss';

export interface OptionSelectDynamic {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: IconName;
  tooltipText?: string;
}

export interface Props {
  placeholder?: string;
  label?: string;
  perPage?: number;
  className?: string;
  helpText?: string;
  extraLabel?: string;
  disabled?: boolean;
  value?: OptionSelectDynamic;
  required?: boolean;
  status?: 'error';
  size?: 'small' | 'medium' | 'large';
  onSelectionChange: (selected: OptionSelectDynamic | undefined) => void;
  searchPlaceholder?: string;
  fetchItems: (params: PaginatedItemsParams, signal?: AbortSignal) => Promise<OptionSelectDynamic[]>;
  items: OptionSelectDynamic[];
  disabledTooltipText?: string;
  hideSearch?: boolean;
  menuPlacement?: 'top' | 'bottom' | 'auto';
  hasMore?: boolean;
  loadingText?: string;
  'data-testid'?: string;
  modalTitle?: string;
  searchDebounceTime?: number;
}

export const SelectDynamic = React.memo(
  forwardRef<HTMLDivElement, Props>(
    ({
      placeholder,
      label,
      perPage = 10,
      className,
      size = 'medium',
      helpText,
      disabled,
      status,
      required,
      extraLabel,
      onSelectionChange,
      searchPlaceholder,
      fetchItems,
      items,
      disabledTooltipText,
      hideSearch = false,
      value,
      menuPlacement,
      hasMore = false,
      loadingText,
      'data-testid': dataTestIdAttribute,
      modalTitle,
      searchDebounceTime = 300,
    }: Props) => {
      const [searchText, setSearchText] = useState('');
      const [isOpen, setIsOpen] = useState(false);
      const [lastScrollTop, setLastScrollTop] = useState(0);
      const containerRef = useRef<HTMLDivElement | null>(null);
      const listRef = useRef<HTMLDivElement | null>(null);
      const dropdownRef = useRef<HTMLDivElement | null>(null);
      const inputAreaIdRef = useRef(`dynamic-select-input-${Math.random().toString(36).substr(2, 9)}`);
      const inputAreaId = inputAreaIdRef.current;
      const debouncedSearchText = useDebounce(searchText, searchDebounceTime);
      const hasMoreRef = useRef(hasMore);
      const { type } = useDevice();

      // Funzione di fetch memorizzata in modo stabile per evitare render loop
      const stableFetchFn = useCallback((params: PaginatedItemsParams, signal?: AbortSignal) => fetchItems(params, signal), [fetchItems]);

      const { loading, error, loadMore } = usePaginatedSingleItems(stableFetchFn, perPage, debouncedSearchText, isOpen, hasMoreRef.current);

      const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
        setSearchText(e.target.value);
      };

      const toggleDropdown = () => {
        if (disabled) return;
        setIsOpen((prev) => !prev);
      };

      const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, cb: () => void) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          cb();
        }
      };

      const handleItemSelect = (item: OptionSelectDynamic) => {
        onSelectionChange(item);
        setIsOpen(false);
      };

      React.useEffect(() => {
        hasMoreRef.current = hasMore;
      }, [hasMore]);

      const handleScroll = useCallback(() => {
        if (listRef.current && !loading && hasMoreRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = listRef.current;
          const isScrollingDown = scrollTop > lastScrollTop;
          setLastScrollTop(scrollTop);
          if (isScrollingDown && scrollTop + clientHeight >= scrollHeight - 10) {
            try {
              loadMore();
            } catch (err) {
              console.error(err);
            }
          }
        }
      }, [loading, lastScrollTop, loadMore]);

      const throttledHandleScroll = useRef(utilityThrottle(handleScroll, 200)).current;

      const getPopoverPosition = () => {
        if (menuPlacement === 'top') {
          return {
            position: { vertical: 'top', horizontal: 'left' } as PopoverOrigin,
            transformOrigin: { vertical: 'bottom', horizontal: 'left' } as PopoverOrigin,
          };
        }
        if (menuPlacement === 'auto') {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const searchBarHeight = hideSearch ? 0 : 73;
            const marginHeight = 8;
            const itemsHeight = Math.min(items.length, 6) * 48;
            const dropdownHeight = itemsHeight + searchBarHeight + marginHeight;
            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
              return {
                position: { vertical: 'top', horizontal: 'left' } as PopoverOrigin,
                transformOrigin: { vertical: 'bottom', horizontal: 'left' } as PopoverOrigin,
              };
            }
          }
        }
        return {
          position: { vertical: 'bottom', horizontal: 'left' } as PopoverOrigin,
          transformOrigin: { vertical: 'top', horizontal: 'left' } as PopoverOrigin,
        };
      };

      const { position, transformOrigin } = getPopoverPosition();

      const dropdownContent = (
        <div className='ds-dropdown' role='listbox' tabIndex={0} onClick={(e) => e.stopPropagation()} ref={dropdownRef}>
          {!hideSearch && (
            <div className='ds-search'>
              <Input size={size} placeholder={searchPlaceholder} onChange={handleSearchChange} value={searchText} leftIconName='search' />
            </div>
          )}
          <div className='ds-list' ref={listRef} onScroll={throttledHandleScroll}>
            {items.map((item, index) => (
              <div
                key={index}
                className={`ds-list-item ${item.disabled ? 'disabled' : ''}`}
                onClick={!item.disabled ? () => handleItemSelect(item) : undefined}
                role='option'
                tabIndex={0}
              >
                {item.disabled && disabledTooltipText && (
                  <Tooltip followCursor title={disabledTooltipText}>
                    <span className='ds-disabled-icon'>
                      <Icon iconName='exclamation' size={size} />
                    </span>
                  </Tooltip>
                )}
                {item.icon && <Icon iconName={item.icon} size={size} />}
                {item.tooltipText ? (
                  <Tooltip title={item.tooltipText} placement='right'>
                    <div className='ds-list-item-label'>{item.label}</div>
                  </Tooltip>
                ) : (
                  <div className='ds-list-item-label'>{item.label}</div>
                )}
              </div>
            ))}
            {loading && (
              <div className={classNames('ds-loading', { empty: items?.length === 0 })}>
                <Spinner size={items?.length ? 'small' : 'medium'} type='dotted-circle' />
                {loadingText && items?.length === 0 && <span className='ds-loading-text'>{loadingText}</span>}
              </div>
            )}
            {error && <div className='ds-error'>{error}</div>}
          </div>
        </div>
      );

      const triggerElement = (
        <div>
          {label && (
            <label className='ds-label' htmlFor={inputAreaId}>
              {label}
              {required && <span className='ds-required'>*</span>}
              {extraLabel && <span className='ds-extra-label'>{extraLabel}</span>}
            </label>
          )}
          <div
            id={inputAreaId}
            className={classNames('ds-input-area', { disabled })}
            role='button'
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              toggleDropdown();
            }}
            onKeyDown={(e) => handleKeyDown(e, toggleDropdown)}
          >
            <div className='ds-selected-container'>
              {value ? <span className='ds-selected-label'>{value.label}</span> : <span className='ds-placeholder'>{placeholder}</span>}
            </div>
            <Icon size={size} iconName={isOpen ? 'chevron-up' : 'chevron-down'} />
          </div>
          {helpText && <div className='ds-help-text'>{helpText}</div>}
        </div>
      );

      if (type !== 'desktop') {
        return (
          <div
            ref={containerRef}
            className={classNames('dynamic-select', className, size, { open: isOpen, [`${status}`]: status })}
            onClick={() => setIsOpen(false)}
            aria-haspopup='listbox'
            aria-expanded={isOpen}
            data-testid={dataTestIdAttribute}
          >
            {triggerElement}
            <Modal
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              verticalPosition='bottom'
              size='small'
              className='select-dynamic-modal'
              disabledMobileAnimation
              closeOnBackDropClick
            >
              <Modal.Header onClose={() => setIsOpen(false)} closeIcon>
                {modalTitle && <span>{modalTitle}</span>}
                {!modalTitle && label && <span>{label}</span>}
              </Modal.Header>
              <Modal.Content>{dropdownContent}</Modal.Content>
            </Modal>
          </div>
        );
      }

      return (
        <div
          ref={containerRef}
          className={classNames('dynamic-select', className, size, { open: isOpen, [`${status}`]: status })}
          onClick={() => setIsOpen(false)}
          aria-haspopup='listbox'
          aria-expanded={isOpen}
          data-testid={dataTestIdAttribute}
        >
          <Popover
            isOpen={isOpen}
            position={position}
            transformOrigin={transformOrigin}
            onClose={() => setIsOpen(false)}
            className='ds-popover'
            trigger={triggerElement}
          >
            {dropdownContent}
          </Popover>
        </div>
      );
    },
  ),
);
