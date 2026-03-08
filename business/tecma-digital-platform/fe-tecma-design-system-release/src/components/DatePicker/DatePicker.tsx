/* eslint-disable react/require-default-props */
import React, { Ref, forwardRef, useEffect, useState } from 'react';

import classNames from 'classnames';
import { DateTime } from 'luxon';
import RCPicker, { PickerProps, PickerRef } from 'rc-picker';
import { GenerateConfig } from 'rc-picker/lib/generate';
import luxonGenerateConfig from 'rc-picker/lib/generate/luxon';
import { BaseInfo, Locale } from 'rc-picker/lib/interface';
import InfiniteCalendar from 'react-infinite-calendar';

import { Icon } from '../Icon';
import { getStatusClassNames, getLocale, transPlacement2DropdownAlign, getCurrentViewMode } from './utils';
import { Spinner } from '../Spinner';
import DatePickerMobile, { DatePickerMobileProps } from './DatePickerMobile';
import { IconName } from '../Icon/IconName';

import variables from '../../styles/theme/variables.module.scss';
import 'react-infinite-calendar/styles.css';
import '../../styles/date-picker.scss';

export interface DatePickerProps
  extends Omit<Partial<PickerProps<DateTime>>, 'value'>,
    Omit<DatePickerMobileProps, 'value' | 'minDate' | 'width' | 'height' | 'onScroll' | 'maxDate' | 'locale'> {
  value?: DateTime | string | null;
  loading?: boolean;
  localeLang: string;
  locale?: Locale;
  bordered?: 'full' | 'bottom' | 'none';
  status?: 'success' | 'error' | 'warning' | 'validating';
  placement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
  label?: string;
  extraLabel?: string;
  helpText?: string;
  customLoaderComponent?: React.ReactElement;
  customPopupContainer?: HTMLElement;
  dataTestId?: string;
  allowClear?: boolean;
  withCheckOut?: boolean;
  onReset?: () => void;
  onCalendarChange?: (date: DateTime | DateTime[], dateString: string | string[], info?: BaseInfo) => void;
  suffixIcon?: IconName;
}

const DatePicker = (generateConfig: GenerateConfig<DateTime>) =>
  forwardRef<PickerRef, DatePickerProps>((props, ref) => {
    const {
      className,
      label,
      extraLabel,
      helpText,
      locale,
      localeLang,
      required,
      status,
      customPopupContainer,
      loading,
      customLoaderComponent,
      direction = 'ltr',
      bordered = 'full',
      placement = 'topLeft',
      prefixCls = 'tecma-date-picker',
      dataTestId = 'tecma-datePicker',
      allowClear = false,
      onReset,
      onCalendarChange,
      value,
      suffixIcon,
      ...rest
    } = props;

    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>(() => getCurrentViewMode(Number.parseInt(variables.tablet, 10)));
    const mobileDatePickerProps: Partial<DatePickerMobileProps> = {
      confirmDateLabel: props.confirmDateLabel,
      resetDateLabel: props.resetDateLabel,
      placeholder: props.placeholder,
      disabledDates: props.disabledDates,
      disabledDays: props.disabledDays,
      mobileTitleLabel: props.mobileTitleLabel,
      mobileSubTitleLabel: props.mobileSubTitleLabel,
      formatDateOptions: props.formatDateOptions,
      localeMobileConfig: props.localeMobileConfig,
      minDate: props.minDate?.toJSDate(),
      maxDate: props.maxDate?.toJSDate(),
      onReset: props.onReset,
      onClose: props.onClose,
      onConfirm: props.onConfirm,
    };

    const localeConfig = { ...getLocale(localeLang), ...locale };
    useEffect(() => {
      const updateViewMode = () => {
        setViewMode((curr) => {
          const newViewMode = getCurrentViewMode(Number.parseInt(variables.tablet, 10));
          if (curr !== newViewMode) {
            return newViewMode;
          }
          return curr;
        });
      };
      window.addEventListener('resize', updateViewMode);
      return () => {
        window.removeEventListener('resize', updateViewMode);
      };
    }, []);

    const getPopupContainer = (node: HTMLElement): HTMLElement => {
      return customPopupContainer ?? (node.parentElement as HTMLElement);
    };

    const panelRender = (originalPanel: React.ReactNode) => {
      return (
        <>
          {originalPanel}
          {loading ? (
            <div className={`tecma-date-picker-loader ${customLoaderComponent ? '' : 'traditional'}`}>
              {customLoaderComponent ?? <Spinner />}
            </div>
          ) : null}
        </>
      );
    };

    const convertDateValueFromIso = (date?: DateTime | string | null): DateTime | undefined => {
      if (date) {
        return typeof date === 'string' ? DateTime.fromISO(date) : date;
      }
      return undefined;
    };

    if (viewMode === 'mobile') {
      return (
        <DatePickerMobile
          value={convertDateValueFromIso(value)}
          localeLang={localeLang}
          ref={ref as unknown as Ref<InfiniteCalendar>}
          {...mobileDatePickerProps}
        />
      );
    }

    return (
      <div className='tecma-date-picker-wrapper' data-testid={dataTestId}>
        {label && (
          <span className='tecma-date-picker-label'>
            {label} {extraLabel && <span className='tecma-date-picker-extra-label'>{extraLabel}</span>}
            {required && '*'}
          </span>
        )}
        <RCPicker
          ref={ref}
          placement={placement}
          popupAlign={transPlacement2DropdownAlign(direction, placement)}
          panelRender={panelRender}
          suffixIcon={<Icon size='small' iconName={suffixIcon ?? 'calendar'} />}
          allowClear={allowClear ? { clearIcon: <Icon size='small' iconName='x-circle' /> } : false}
          prevIcon={<span className='tecma-date-picker-prev-icon' />}
          nextIcon={<span className='tecma-date-picker-next-icon' />}
          superPrevIcon={<span className='tecma-date-picker-super-prev-icon' />}
          superNextIcon={<span className='tecma-date-picker-super-next-icon' />}
          transitionName='tecma-slide-up'
          className={classNames(
            {
              'tecma-date-picker-borderless': bordered === 'none',
              'tecma-date-picker-border-bottom': bordered === 'bottom',
            },
            getStatusClassNames(prefixCls, status),
            className,
          )}
          prefixCls={prefixCls}
          generateConfig={generateConfig}
          getPopupContainer={getPopupContainer}
          direction={direction}
          locale={localeConfig as Locale}
          onCalendarChange={onCalendarChange}
          value={convertDateValueFromIso(value)}
          {...rest}
        />
        {helpText && <span className={`tecma-date-picker-help-text ${status ?? ''}`}>{helpText}</span>}
      </div>
    );
  });

export default DatePicker(luxonGenerateConfig);
