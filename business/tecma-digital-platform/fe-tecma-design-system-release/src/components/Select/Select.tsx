/* eslint-disable no-nested-ternary */
import React, { ReactElement, ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import ReactSelect, {
  ControlProps,
  DropdownIndicatorProps,
  GroupBase,
  MenuListProps,
  MultiValue,
  MultiValueRemoveProps,
  OptionProps,
  OptionsOrGroups,
  PropsValue,
  SingleValue,
  StylesConfig,
  ValueContainerProps,
  components,
} from 'react-select';
import type {} from 'react-select/base';

import useDidMountEffect from '../../hooks/useDidMountEffect';
import { useDevice } from '../../hooks/useDevice';
import variables from '../../styles/theme/variables.module.scss';
import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { Icon } from '../Icon';
import { Input } from '../Input';
import { Tooltip } from '../Tooltip';
import { Modal } from '../Modal';

import type { IconName } from '../Icon/IconName';

import '../../styles/select.scss';

declare module 'react-select/base' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface Props<Option, IsMulti extends boolean, Group extends GroupBase<Option>> {
    isRequired?: boolean;
    error?: boolean;
    label?: string;
    defaultValue?: Option[];
    helpText?: ReactNode;
    dataTestId?: string;
    fluid?: boolean;
    onMenuInputFocus?: () => void;
    withSearch?: boolean;
    searchPlaceholder?: string;
    maxItemSelectedToShow?: number;
  }
}

export interface OptionSelect {
  type?: string;
  icon?: ReactElement | IconName;
  value: string;
  label: string;
  disabled?: boolean;
  tooltipText?: string;
}

export interface SelectProps {
  options: OptionSelect[];
  value: OptionSelect[] | OptionSelect;
  onChange: (newValue: OptionSelect[] | OptionSelect) => void;
  helpText?: ReactNode;
  placeholder?: string;
  name?: string;
  defaultValue?: OptionSelect[];
  isMulti?: boolean;
  label?: string;
  extraLabel?: ReactNode;
  noOptionsMessage?: string;
  maxItemSelectedToShow?: number;
  onBlur?: (event: React.FocusEvent<HTMLInputElement, Element>) => void;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
  error?: boolean;
  warning?: boolean;
  isRequired?: boolean;
  isLoading?: boolean;
  dataTestId?: string;
  'data-testid'?: string;
  fluid?: boolean;
  searchPlaceholder?: string;
  isSearchable?: boolean;
  sortBySelectedOptions?: boolean;
  hideSelectedOptions?: boolean;
  isClearable?: boolean;
  closeMenuOnSelect?: boolean;
  showSelectedItemRemoveIcon?: boolean;
  selectAllLabel?: string;
  deselectAllLabel?: string;
  menuPlacement?: 'auto' | 'bottom' | 'top';
  disabled?: boolean;
  dropDownWidth?: number;
  menuPortalTarget?: HTMLElement;
  disabledOptionTooltip?: string;
  allowDisabledOptionSelection?: boolean;
  showIconInValueContainer?: boolean;
  modalTitle?: string;
}

const DropdownIndicator = (props: DropdownIndicatorProps<OptionSelect, boolean, GroupBase<OptionSelect>>) => {
  const {
    selectProps: { menuIsOpen, isLoading },
  } = props;
  if (!isLoading) {
    return <components.DropdownIndicator {...props} className={`dropdownIndicator ${menuIsOpen ? 'isOpen' : ''}`} />;
  }
  return null;
};

const MultiValueRemove = (props: MultiValueRemoveProps, showRemoveIcon: boolean) => {
  return showRemoveIcon ? (
    <components.MultiValueRemove {...props}>
      <Icon iconName='x' size='extra-small' />
    </components.MultiValueRemove>
  ) : (
    <span style={{ width: 10 }} />
  );
};

const Option = (
  props: OptionProps<OptionSelect, boolean, GroupBase<OptionSelect>>,
  disabledOptionTooltip?: string,
  allowDisabledOptionSelection?: boolean,
) => {
  const { children, isSelected, isMulti, ...rest } = props;
  const dataOption = rest.data;
  const renderIcon = () => {
    if (dataOption.disabled) {
      return (
        <Tooltip title={disabledOptionTooltip} className='disabled-option-tooltip' placement='top'>
          <div className='disabled-option-tooltip-icon-wrapper'>
            <Icon className='disabled-option-tooltip-icon' iconName='exclamation' size='small' filled />
          </div>
        </Tooltip>
      );
    }
    if (dataOption.icon) {
      if (typeof dataOption.icon === 'string') {
        return <Icon iconName={dataOption.icon} size='small' />;
      }
      return dataOption.icon;
    }
    return null;
  };

  const disabledClass = !allowDisabledOptionSelection && dataOption.disabled ? 'disabled-option' : '';
  const selectedClass = isSelected ? 'isSelected' : '';

  if (isMulti) {
    return (
      <components.Option
        {...rest}
        isMulti
        className={`${selectedClass} ${disabledClass}`}
        isSelected={isSelected}
        innerProps={{
          // @ts-ignore
          'data-testid': `select-option-${rest.data.value}`,
          ...props.innerProps,
          onClick: (e: React.MouseEvent<HTMLDivElement>) => {
            if (!allowDisabledOptionSelection && dataOption.disabled) {
              e.stopPropagation();
              return;
            }
            if (props.innerProps?.onClick) {
              props.innerProps.onClick(e);
            }
          },
        }}
      >
        <Checkbox checked={isSelected} size='small' disabled={dataOption.disabled && !allowDisabledOptionSelection} />

        {dataOption.tooltipText ? (
          <Tooltip title={dataOption.tooltipText} placement='right'>
            <div className='option-wrapper'>
              {dataOption.icon && renderIcon()}
              <span>{children}</span>
            </div>
          </Tooltip>
        ) : (
          <div className='option-wrapper'>
            {dataOption.icon && renderIcon()}
            <span>{children}</span>
          </div>
        )}
      </components.Option>
    );
  }

  return (
    <components.Option
      {...rest}
      className={`${selectedClass} ${disabledClass}`}
      isMulti={false}
      isSelected={isSelected}
      innerProps={{
        // @ts-ignore
        'data-testid': `select-option-${rest.data.value}`,
        ...props.innerProps,
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          if (!allowDisabledOptionSelection && dataOption.disabled) {
            e.stopPropagation();
            return;
          }
          if (props.innerProps?.onClick) {
            props.innerProps.onClick(e);
          }
        },
      }}
    >
      {dataOption.tooltipText ? (
        <Tooltip title={dataOption.tooltipText} placement='right'>
          <div className='option-wrapper'>
            {renderIcon()}
            <span>{children}</span>
          </div>
        </Tooltip>
      ) : (
        <div className='option-wrapper'>
          {renderIcon()}
          <span>{children}</span>
        </div>
      )}
      {isSelected ? (
        <div className='checkIcon'>
          <Icon color='primary' iconName='check' size='extra-small' />
        </div>
      ) : (
        ''
      )}
    </components.Option>
  );
};

const Control = (props: ControlProps<OptionSelect, boolean, GroupBase<OptionSelect>>) => {
  const { children, ...rest } = props;
  const { isLoading } = rest.selectProps;
  return (
    <components.Control {...rest} className={`${isLoading ? 'control-isLoading' : ''}`}>
      {children}
    </components.Control>
  );
};

const ValueContainer = (
  props: ValueContainerProps<OptionSelect, boolean, GroupBase<OptionSelect>>,
  disabledOptionTooltip?: string,
  showIconInValueContainer?: boolean,
) => {
  const { children, selectProps, ...rest } = props;
  const { error } = selectProps;
  const childrenArray = React.Children.toArray(children);
  const childrenWithoutSecondInput = childrenArray.filter((child) => React.isValidElement(child) && child.key !== '.1');

  const renderIcon = (icon: ReactElement | IconName) => {
    if (icon) {
      if (typeof icon === 'string') {
        return <Icon iconName={icon} size='small' style={{ marginRight: '0.25rem' }} />;
      }
      return <div style={{ marginRight: '0.25rem' }}>{icon}</div>;
    }
    return null;
  };

  return (
    <components.ValueContainer {...rest} selectProps={selectProps}>
      {rest.getValue()[0]?.disabled && (
        <Tooltip title={disabledOptionTooltip} className='disabled-option-tooltip' placement='top'>
          <div className='disabled-option-tooltip-icon-wrapper' style={{ marginRight: '0.5rem' }}>
            <Icon className='disabled-option-tooltip-icon' iconName='exclamation' size='small' filled />
          </div>
        </Tooltip>
      )}
      {childrenWithoutSecondInput.map((child) => {
        if (child)
          return (
            <>
              {showIconInValueContainer && renderIcon((child as ReactElement).props?.data?.icon)} {child}
            </>
          );
        return rest.hasValue ? (
          <div className='single-value'>{selectProps.getOptionLabel(rest.getValue()[0])}</div>
        ) : (
          <div className='placeholder'>{selectProps.placeholder}</div>
        );
      })}
      {error && <Icon className='error-icon' iconName='exclamation-circle' />}
    </components.ValueContainer>
  );
};

const MenuList = (
  props: MenuListProps<OptionSelect, boolean, GroupBase<OptionSelect>>,
  selectAllLabel: string,
  deselectAllLabel: string,
  inputValueRef: React.MutableRefObject<PropsValue<OptionSelect>>,
  menuScrollPosition: number,
  modalTitle?: string,
  onMenuCloseCallback?: () => void,
) => {
  const { selectProps, innerRef, ...rest } = props;
  const {
    value,
    onInputChange,
    inputValue,
    onChange,
    options,
    isMulti,
    onMenuInputFocus,
    withSearch = false,
    searchPlaceholder = 'Search',
    menuIsOpen,
  } = selectProps;
  const { type } = useDevice();
  const menuListRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Copied from source
  const ariaAttributes = {
    'aria-label': selectProps['aria-label'],
    'aria-labelledby': selectProps['aria-labelledby'],
  };

  React.useEffect(() => {
    if (menuListRef.current && inputValueRef.current !== value) {
      if (menuScrollPosition) {
        menuListRef.current.scrollTop = menuScrollPosition;
      }
      inputValueRef.current = value;
    }
  }, [inputValueRef, menuScrollPosition, value]);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const menuContent = (
    <div className='select-menu-list'>
      {withSearch && (
        <Input
          ref={inputRef}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 10,
            border: 'none',
            borderBottom: '1px solid lightgrey',
          }}
          iconName='search'
          autoCorrect='off'
          autoComplete='off'
          spellCheck='false'
          type='text'
          value={inputValue}
          onChange={(e) => {
            onInputChange(e.currentTarget.value, {
              prevInputValue: inputValue,
              action: 'input-change',
            });
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            (e.target as HTMLElement)?.focus();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            (e.target as HTMLElement)?.focus();
          }}
          onFocus={onMenuInputFocus}
          placeholder={searchPlaceholder}
          aria-autocomplete='list'
          {...ariaAttributes}
        />
      )}
      {isMulti && (
        <div className='multi-select-heading'>
          <Button
            onClick={() => {
              onChange(options as OptionSelect[], {
                action: 'select-option',
                option: undefined,
              });
            }}
            size='small'
            color='transparent'
          >
            {selectAllLabel}
          </Button>
          <Button
            onClick={() => {
              onChange([], {
                action: 'deselect-option',
                option: undefined,
              });
            }}
            size='small'
            color='transparent'
          >
            {deselectAllLabel}
          </Button>
        </div>
      )}
      <components.MenuList
        {...rest}
        className={`${rest.className} select__menu`}
        selectProps={selectProps}
        innerRef={(node) => {
          if (innerRef && typeof innerRef === 'function') {
            innerRef(node);
          }
          menuListRef.current = node;
        }}
      />
    </div>
  );

  if (type !== 'desktop') {
    return (
      <Modal
        isOpen={menuIsOpen}
        closeOnBackDropClick
        onClose={() => {
          onMenuCloseCallback?.();
        }}
        verticalPosition='bottom'
        size='small'
        className='select-menu-list'
        disabledMobileAnimation
      >
        <Modal.Header
          onClose={() => {
            onMenuCloseCallback?.();
          }}
          closeIcon
        >
          {modalTitle && <span>{modalTitle}</span>}
        </Modal.Header>
        <Modal.Content>{menuContent}</Modal.Content>
      </Modal>
    );
  }

  return menuContent;
};

const Select = React.forwardRef<HTMLDivElement, SelectProps>((props, ref) => {
  const {
    options,
    onChange,
    placeholder,
    noOptionsMessage,
    label = '',
    extraLabel,
    value,
    isMulti,
    onBlur,
    onMenuOpen,
    onMenuClose,
    name = 'select',
    defaultValue = [],
    error = false,
    warning = false,
    isRequired = false,
    isLoading = false,
    helpText = '',
    dataTestId = 'tecma-select',
    'data-testid': dataTestIdAttribute,
    fluid,
    searchPlaceholder = 'Search option...',
    isSearchable = false,
    hideSelectedOptions = false,
    sortBySelectedOptions = false,
    isClearable = false,
    closeMenuOnSelect,
    maxItemSelectedToShow = 3,
    showSelectedItemRemoveIcon = true,
    selectAllLabel = 'Select all',
    deselectAllLabel = 'Deselect all',
    menuPlacement = 'bottom',
    disabled,
    dropDownWidth,
    menuPortalTarget,
    disabledOptionTooltip,
    allowDisabledOptionSelection = false,
    showIconInValueContainer = false,
    modalTitle,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const menuRef = useRef<any>(null);
  const inputValueRef = React.useRef<PropsValue<OptionSelect>>(value);
  const touchStartPosition = useRef<{ x: number; y: number } | null>(null);
  const hasMoved = useRef<boolean>(false);
  const [menuIsOpen, setMenuIsOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [optionList, setOptionList] = useState<OptionsOrGroups<OptionSelect, GroupBase<OptionSelect>>>();
  const customStyles: StylesConfig<OptionSelect, boolean, GroupBase<OptionSelect>> = {
    placeholder: (styles, { selectProps }) => ({
      ...styles,
      color: variables?.onGeneralSub,
      fontWeight: '400',
      fontSize: '0.875rem',
      display: 'inline',
      fontFamily: 'Lato, sans-serif',
      lineHeight: '1.5rem',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      overflowX: 'clip',
      overflow: 'hidden',
      flexWrap: 'nowrap',
      maxWidth: selectProps.error ? 'calc(100% - 0.5rem)' : 'unset',
    }),
    control: (styles, { isDisabled }) => {
      return {
        ...styles,
        borderRadius: variables?.borderRadiusElement,
        borderTopRightRadius: dropDownWidth ? 0 : variables?.borderRadiusElement,
        borderBottomRightRadius: dropDownWidth ? 0 : variables?.borderRadiusElement,
        height: '2.5rem',
        minWidth: dropDownWidth ? 'none' : '10rem',
        flexWrap: 'nowrap',
        boxShadow: 'none',
        cursor: 'pointer',
        borderColor: error ? variables?.semanticDanger : variables?.generalBorder,
        borderWidth: '1px',
        background: isDisabled ? variables?.disabled : 'initial',
        '&:hover': {
          borderColor: error ? variables?.semanticDanger : variables?.accent,
          borderWidth: '1px',
        },
        '&:focus': {
          borderColor: error ? variables?.semanticDanger : variables?.accent,
          borderWidth: '1px',
        },
      };
    },
    menu: (styles) => ({
      ...styles,
      width: dropDownWidth ? `${dropDownWidth}px` : '100%',
    }),
    menuList: (styles) => ({
      ...styles,
      margin: '0',
      boxShadow: '0px 2px 18px 0px rgba(100, 100, 100, 0.25)',
      borderRightWidth: '0.5rem',
      padding: '0',
      maxHeight: '18rem',
      WebkitBoxShadow: 'none',
      borderRadius: variables?.borderRadiusExternal,
      '&::-webkit-scrollbar ': {
        width: '4px',
        backgroundColor: '#dbe1e1',
        borderRadius: '100px',
      },
      '&::-webkit-scrollbar-thumb ': {
        backgroundColor: '#969e9eAA',
        borderRadius: '100px',
      },
    }),
    option: (styles, { isDisabled, isFocused, isSelected, isMulti: isMultiProp }) => ({
      ...styles,
      fontSize: '14px',
      fontWeight: '400',
      display: 'flex',
      height: '3rem',
      padding: '0 1rem',
      position: 'relative',
      alignItems: 'center',
      fontFamily: 'Lato, sans-serif',
      justifyContent: isMultiProp ? 'initial' : 'space-between',
      backgroundColor: isFocused ? variables?.generalHover : undefined,
      color: isDisabled ? variables?.neutral80 : isSelected && !isMultiProp ? variables?.accent : variables?.onGeneral,
      '.checkIcon': {
        svg: {
          width: '1rem',
          height: '1rem',
          color: variables?.accent,
        },
      },
      '&:active': {
        backgroundColor: variables?.primaryLight,
      },
    }),
    valueContainer: (styles, { selectProps, hasValue }) => ({
      ...styles,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      display: selectProps.isMulti && hasValue ? 'inline' : 'flex',
      alignSelf: 'center',
      padding: `0 ${selectProps.error ? '1.5rem' : '0'} 0 0.5rem`,
    }),
    singleValue: (styles) => ({
      ...styles,
      color: variables?.onGeneral,
      fontFamily: 'Lato, sans-serif',
      fontWeight: '400',
      fontSize: '14px',
      display: 'inline-block',
      textOverflow: dropDownWidth ? 'initial' : 'ellipsis',
    }),
    multiValue: () => ({
      display: 'inline-flex',
      color: variables?.onHover,
      minHeight: '22px',
      // maxWidth: `calc(100% / ${selectProps.maxItemSelectedToShow} - 1rem)`,
      marginRight: '10px',
      backgroundColor: variables?.accentLight,
      borderRadius: variables?.borderRadiusInternal,
      ':not(:first-of-type)': {},
    }),
    multiValueLabel: () => ({
      fontWeight: '500',
      fontFamily: 'Lato, sans-serif',
      fontSize: '0.75rem',
      fontStyle: 'normal',
      lineHeight: '1rem',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      padding: '0.25rem 0.5rem',
      paddingRight: '10px',
      textOverflow: 'ellipsis',
      alignSelf: 'center',
      marginRight: '-12px',
    }),
    multiValueRemove: (styles) => ({
      ...styles,
      transition: 'background-color 300ms, stroke 300ms',
      svg: {
        width: '1rem',
      },
      ':hover': {
        backgroundColor: 'transparent',
        cursor: 'pointer',
      },
    }),
    input: (styles) => ({
      ...styles,
      margin: '0',
      paddingTop: '0',
      fontSize: '14px',
      paddingBottom: '0',
      marginLeft: '5px',
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    indicatorsContainer: (styles) => ({
      ...styles,
      svg: {
        color: '#808080',
      },
    }),
  };

  const handleOnChange = (newValue: MultiValue<OptionSelect> | SingleValue<OptionSelect>) => {
    setIsInputFocused(false);
    if (onChange) {
      onChange(newValue as OptionSelect[]);
    }
    if (closeMenuOnSelect || (!isMulti && closeMenuOnSelect == null)) {
      setMenuIsOpen(false);
    }
  };
  const Options = useCallback((): OptionsOrGroups<OptionSelect, GroupBase<OptionSelect>> | undefined => {
    if (isMulti) {
      const optionsSelected = sortBySelectedOptions ? value : [];
      const optionsWithSelectedOption = [
        ...(defaultValue ?? []),
        ...(optionsSelected as OptionSelect[]),
        ...(options?.filter((option) => {
          return (
            !defaultValue?.find((optionSelect) => optionSelect.value === option.value) &&
            (sortBySelectedOptions ? !(value as OptionSelect[]).find((optionSelect) => optionSelect.value === option.value) : true)
          );
        }) ?? []),
      ];
      return optionsWithSelectedOption;
    }
    return options;
  }, [defaultValue, isMulti, options, sortBySelectedOptions, value]);
  const onDomClick = useCallback(
    (e: Event) => {
      if (!disabled) {
        const menu = containerRef.current?.querySelector('.select__menu') || containerRef.current?.querySelector('.select-menu-list');
        const buttonToggle = containerRef.current?.querySelector('.select__dropdown-indicator');
        if (!containerRef.current?.contains(e.target as Node) || !menu || !menu.contains(e.target as Node)) {
          setIsInputFocused(false);
          setInputValue('');
        }
        if (containerRef.current?.contains(e.target as Node)) {
          if (menu && buttonToggle?.contains(e.target as Node)) {
            setMenuIsOpen(false);
          } else {
            setMenuIsOpen(true);
          }
        } else {
          if (window.innerWidth > 1024) {
            setMenuIsOpen(false);
          }
        }
      }
    },
    [disabled],
  );

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartPosition.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      hasMoved.current = false;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartPosition.current && e.touches.length > 0) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartPosition.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartPosition.current.y);
      // If touch moved more than 5px, consider it a scroll
      if (deltaX > 5 || deltaY > 5) {
        hasMoved.current = true;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      // Only trigger onDomClick if it was a tap (not a scroll)
      if (!hasMoved.current) {
        onDomClick(e);
      }
      // Reset tracking
      touchStartPosition.current = null;
      hasMoved.current = false;
    },
    [onDomClick],
  );

  useEffect(() => {
    setOptionList(Options());
    document.addEventListener('mousedown', onDomClick);
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousedown', onDomClick);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onDomClick]);

  useDidMountEffect(() => {
    if (menuIsOpen && onMenuOpen) {
      onMenuOpen();
    } else if (!menuIsOpen && onMenuClose) {
      onMenuClose();
    }
  }, [menuIsOpen]);

  useEffect(() => {
    setOptionList(Options());
  }, [options]);

  return (
    <div data-testid={dataTestIdAttribute ?? dataTestId} className={`tecma-select ${warning ? 'warning' : ''}`} ref={ref}>
      {label && (
        <span className='tecma-select-label'>
          {label} {extraLabel && <span className='tecma-select-extra-label'>{extraLabel}</span>}
          {isRequired && '*'}
        </span>
      )}
      <div ref={containerRef} className={`tecma-select-box ${fluid ? 'fluid' : ''}`}>
        <ReactSelect
          ref={menuRef}
          value={value}
          classNamePrefix='select'
          onMenuOpen={() => {
            document.body.style.overflow = 'hidden';
          }}
          onMenuClose={() => {
            document.body.style.overflow = 'auto';
          }}
          isDisabled={disabled}
          menuPlacement={menuPlacement}
          isLoading={isLoading}
          components={{
            Option: (componentProps) => Option(componentProps, disabledOptionTooltip, allowDisabledOptionSelection),
            MultiValueRemove: (componentProps) => MultiValueRemove(componentProps, showSelectedItemRemoveIcon),
            DropdownIndicator,
            Control,
            MenuList: (componentProps) =>
              MenuList(
                componentProps,
                selectAllLabel,
                deselectAllLabel,
                inputValueRef,
                menuRef.current?.menuListRef?.scrollTop,
                modalTitle,
                () => setMenuIsOpen(false),
              ),
            ValueContainer: (componentProps) => ValueContainer(componentProps, disabledOptionTooltip, showIconInValueContainer),
          }}
          inputValue={inputValue}
          options={optionList}
          styles={customStyles}
          menuPortalTarget={menuPortalTarget}
          isMulti={isMulti}
          closeMenuOnSelect={closeMenuOnSelect}
          isClearable={isClearable}
          searchPlaceholder={searchPlaceholder}
          hideSelectedOptions={hideSelectedOptions}
          noOptionsMessage={() => noOptionsMessage}
          placeholder={placeholder}
          isSearchable={false}
          withSearch={isSearchable}
          onChange={handleOnChange}
          onInputChange={(val) => setInputValue(val)}
          onMenuInputFocus={() => setIsInputFocused(true)}
          name={name}
          maxItemSelectedToShow={maxItemSelectedToShow}
          onBlur={(e) => onBlur?.({ ...e, target: { ...e.target, name: name ?? '' } })}
          error={error}
          menuIsOpen={menuIsOpen}
          {...{
            isFocused: isInputFocused || undefined,
          }}
        />
      </div>
      {(error || warning) && helpText && <span className='help-text'>{helpText}</span>}
    </div>
  );
});

export default Select;
