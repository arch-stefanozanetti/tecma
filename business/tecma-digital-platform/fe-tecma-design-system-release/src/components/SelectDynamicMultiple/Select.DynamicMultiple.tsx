import React, { useState, useRef, ChangeEvent, KeyboardEvent, useCallback, useEffect } from 'react';
import classNames from 'classnames';

import { useDebounce } from '../../hooks/useDebounce';
import { useClickOutside } from '../../hooks/useClickOutside';
import { usePaginatedItems } from '../../hooks/usePaginated';
import { useDevice } from '../../hooks/useDevice';
import { Checkbox } from '../Checkbox';
import { Icon } from '../Icon';
import { Input } from '../Input';
import { Spinner } from '../Spinner';
import { Tag } from '../Tag';
import { Tooltip } from '../Tooltip';
import { IconName } from '../Icon/IconName';
import { Modal } from '../Modal';

import '../../styles/selectDynamicMultiple.scss';

export interface OptionSelectDynamic {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: IconName;
  id?: string;
  tooltipText?: string;
}

export interface PaginatedClientsParams {
  page: number;
  perPage: number;
  sortField?: string | null;
  sortOrder?: number | null;
  searchText?: string;
}

export interface Props<T = OptionSelectDynamic> {
  placeholder?: string;
  label?: string;
  perPage?: number;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  onSelectionChange?: (selected: T[]) => void;
  clearSelectionText?: string;
  inputPlaceholder?: string;
  fetchClients?: (params: PaginatedClientsParams, signal?: AbortSignal) => Promise<T[]>;
  items: T[];
  useShowMorePagination?: boolean;
  showMoreText?: string;
  disabledTooltipText?: string;
  loadingText?: string;
  emptyStateText?: string;
  value?: T[];
  loadMoreFunction?: (searchText: string) => void;
  hasMoreItems?: boolean;
  disabled?: boolean;
  localSearch?: boolean;
  seeAllText?: string;
  modalTitle?: string;
  searchDebounceTime?: number;
  hideSearch?: boolean;
  disableGroupSelectedItems?: boolean;
}

export const SelectDynamicMultiple = React.memo(
  <T extends OptionSelectDynamic = OptionSelectDynamic>({
    placeholder,
    label,
    perPage = 10,
    className,
    size = 'medium',
    onSelectionChange,
    clearSelectionText,
    inputPlaceholder,
    fetchClients,
    items,
    useShowMorePagination,
    showMoreText,
    disabledTooltipText,
    loadingText,
    emptyStateText,
    value,
    loadMoreFunction,
    hasMoreItems,
    disabled,
    localSearch,
    modalTitle,
    seeAllText = 'See all',
    searchDebounceTime = 300,
    hideSearch = false,
    disableGroupSelectedItems = false,
  }: Props<T>) => {
    const [selectedItems, setSelectedItems] = useState<T[]>(value || []);
    const [searchText, setSearchText] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [displayedItems, setDisplayedItems] = useState<T[]>(items);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const inputAreaId = useRef(`dynamic-multi-select-input-${Math.random().toString(36).substr(2, 9)}`).current;
    const debouncedSearchText = useDebounce(searchText, searchDebounceTime);
    const { type } = useDevice();

    const fetchFn = useCallback(
      (params: PaginatedClientsParams, signal?: AbortSignal) => {
        if (!fetchClients) {
          return Promise.resolve([]);
        }
        return fetchClients(params, signal);
      },
      [fetchClients],
    );

    const { hasMore, loading, error, loadMore } = usePaginatedItems(fetchFn, perPage, debouncedSearchText, isOpen);

    const handleClickOutside = () => {
      if (type === 'desktop') {
        setIsOpen(false);
      }
    };
    useClickOutside(containerRef, handleClickOutside);

    const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value);

    const toggleDropdown = () => {
      if (!disabled) setIsOpen((prev) => !prev);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, cb: () => void) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cb();
      }
    };

    const getIsSelected = (item: T) =>
      selectedItems.some((sel) => (item.value && sel.value === item.value) || (item.id && sel.id === item.id));

    const handleItemToggle = (item: T) => {
      if (disabled) return;
      const newSelected = getIsSelected(item)
        ? selectedItems.filter((sel) => (item.value && sel.value !== item.value) || (item.id && sel.id !== item.id))
        : [...selectedItems, item];
      setSelectedItems(newSelected);
      if (onSelectionChange) onSelectionChange(newSelected);
    };

    const filteredSelectedList = !debouncedSearchText
      ? selectedItems
      : selectedItems.filter((item) => item.label?.toLowerCase().includes(debouncedSearchText.toLowerCase()));

    const selectedIds = new Set(selectedItems.map((item) => item.value || item.id));

    const unselectedList = items?.filter((item) => !selectedIds.has(item.value || item.id)) || [];

    const tagsContainerRef = useRef<HTMLDivElement | null>(null);
    const [visibleTags, setVisibleTags] = useState<T[]>([]);

    const handleClearSelection = () => {
      setSelectedItems([]);
      if (onSelectionChange) onSelectionChange([]);
      if (listRef.current) listRef.current.scrollTop = 0;
    };

    const handleLoadMore = async () => {
      try {
        await loadMore();
      } catch (error) {
        console.error(error);
      }
    };

    const handleScroll = async () => {
      if (listRef.current && !loading && (hasMore || hasMoreItems)) {
        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 10) {
          loadMoreFunction && loadMoreFunction(searchText);
          await handleLoadMore();
        }
      }
    };

    const handleClearSearch = () => {
      setSearchText('');
    };

    const groupDisplayedItems = () => {
      const sortedSelectedList = filteredSelectedList?.sort((a, b) => a.label?.localeCompare(b.label));
      return localSearch && debouncedSearchText
        ? [...sortedSelectedList, ...unselectedList].filter((item) => item.label?.toLowerCase().includes(debouncedSearchText.toLowerCase()))
        : [...sortedSelectedList, ...unselectedList];
    };

    useEffect(() => {
      if (!tagsContainerRef.current) return;

      const containerWidth = tagsContainerRef.current.clientWidth;
      let accumulatedWidth = 0;
      let visibleCount = 0;

      for (const tag of selectedItems) {
        const tagWidth = 60;
        if (accumulatedWidth + tagWidth > containerWidth - 70) break;
        accumulatedWidth += tagWidth;
        visibleCount++;
      }

      setVisibleTags(selectedItems.slice(0, visibleCount));
    }, [selectedItems, isOpen]);

    useEffect(() => {
      if (isOpen && localSearch) {
        setDisplayedItems(disableGroupSelectedItems ? items : groupDisplayedItems());
      }
    }, [isOpen, debouncedSearchText]);

    useEffect(() => {
      if (isOpen && !localSearch) {
        setDisplayedItems(disableGroupSelectedItems ? items : groupDisplayedItems());
      }
    }, [isOpen, items]);

    const dropdownContent = (
      <div className='dms-dropdown' role='listbox' tabIndex={0} onClick={(e) => e.stopPropagation()}>
        {!hideSearch && (
          <div className='dms-search'>
            <Input
              size={size}
              placeholder={inputPlaceholder}
              onChange={handleSearchChange}
              value={searchText}
              leftIconName='search'
              rightIconName={searchText ? 'x' : undefined}
              onRightIconClick={handleClearSearch}
            />

            <div
              className='dms-clear'
              role='button'
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleClearSelection();
              }}
              onKeyDown={(e) => handleKeyDown(e, handleClearSelection)}
            >
              {clearSelectionText}
            </div>
          </div>
        )}
        <div className='dms-list' ref={listRef} onScroll={handleScroll}>
          {displayedItems.map((item) => (
            <div key={item.value || item.id} className='dms-list-item' onClick={() => handleItemToggle(item)} role='option' tabIndex={0}>
              <Checkbox size={size} checked={getIsSelected(item)} onChange={() => handleItemToggle(item)} />
              {item.disabled && (
                <Tooltip followCursor title={disabledTooltipText}>
                  <div className='disabled-option-tooltip-icon-wrapper'>
                    <Icon className='disabled-option-tooltip-icon' iconName='exclamation' size='small' filled />
                  </div>
                </Tooltip>
              )}
              {item.tooltipText ? (
                <Tooltip title={item.tooltipText} placement='right'>
                  <div className='dms-list-item-label'>{item.label}</div>
                </Tooltip>
              ) : (
                <div className='dms-list-item-label'>{item.label}</div>
              )}
            </div>
          ))}
          {displayedItems && displayedItems.length === 0 && (
            <div className='dms-empty-state'>
              <p>{emptyStateText}</p>
            </div>
          )}
          {useShowMorePagination && (
            <div className='dms-footer'>
              {hasMore && !loading && (
                <div
                  className='dms-show-more'
                  role='button'
                  tabIndex={0}
                  onClick={async (e) => {
                    e.stopPropagation();
                    await handleLoadMore();
                  }}
                  onKeyDown={(e) => handleKeyDown(e, handleLoadMore)}
                >
                  {showMoreText}
                </div>
              )}
            </div>
          )}
          {loading && (
            <div className={classNames('ds-loading', { empty: items?.length === 0 })}>
              <Spinner size={items?.length ? 'small' : 'medium'} type='dotted-circle' />
              {loadingText && items?.length === 0 && <span className='ds-loading-text'>{loadingText}</span>}
            </div>
          )}
          {error && <div className='dms-error'>{error}</div>}
        </div>
      </div>
    );
    return (
      <div
        ref={containerRef}
        className={classNames('dynamic-multi-select', className, size, {
          open: isOpen,
          disabled,
        })}
      >
        {label && (
          <label className='dms-label' htmlFor={inputAreaId}>
            {label}
          </label>
        )}
        <div
          id={inputAreaId}
          className='dms-input-area'
          role='button'
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            toggleDropdown();
          }}
          onKeyDown={(e) => handleKeyDown(e, toggleDropdown)}
        >
          <div className='dms-tags-container' ref={tagsContainerRef}>
            {selectedItems.length === 0 ? (
              <span className='dms-placeholder'>{placeholder}</span>
            ) : (
              visibleTags.map((item) => (
                <Tag
                  key={item.value || item.id}
                  label={item.label || ''}
                  style={
                    item.disabled
                      ? {
                          border: '1px solid rgb(173, 112, 42)',
                          backgroundColor: 'rgba(185, 111, 32, 0.09)',
                        }
                      : undefined
                  }
                />
              ))
            )}
          </div>
          <div className='dms-icon-container' style={{ paddingLeft: '5px' }}>
            {selectedItems.length > 2 && <span className='dms-see-all'>{seeAllText}</span>}
            <Icon size={size} iconName='chevron-down' />
          </div>
        </div>
        {type !== 'desktop' ? (
          <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            verticalPosition='bottom'
            size='small'
            className='select-dynamic-multiple-modal'
            disabledMobileAnimation
            closeOnBackDropClick
          >
            <Modal.Header onClose={() => setIsOpen(false)} closeIcon>
              {modalTitle && <span>{modalTitle}</span>}
            </Modal.Header>
            <Modal.Content>{dropdownContent}</Modal.Content>
          </Modal>
        ) : (
          isOpen && dropdownContent
        )}
      </div>
    );
  },
);
