/* eslint-disable react/require-default-props */
import React, { Ref, forwardRef, useEffect, useState } from 'react';

import classNames from 'classnames';
import { DateTime } from 'luxon';
import { PickerRef, RangePicker as RCRangePicker, RangePickerProps } from 'rc-picker';
import { GenerateConfig } from 'rc-picker/lib/generate';
import luxonGenerateConfig from 'rc-picker/lib/generate/luxon';
import { BaseInfo, Locale } from 'rc-picker/lib/interface';
import InfiniteCalendar from 'react-infinite-calendar';

import { Icon } from '../Icon';
import DateRangePickerMobile, { type DateRangePickerMobileProps } from './DateRangePickerMobile';
import { getStatusClassNames, getLocale, transPlacement2DropdownAlign } from './utils';
import variables from '../../styles/theme/variables.module.scss';
import { getCurrentViewMode } from '../DatePicker/utils';
import { Spinner } from '../Spinner';

import type { RangeValueType } from 'rc-picker/lib/PickerInput/RangePicker';
import '../../styles/date-range-picker.scss';

export interface DateRangePickerProps
  extends Omit<Partial<RangePickerProps<DateTime>>, "value">,
    Omit<
      DateRangePickerMobileProps,
      "value" | "minDate" | "width" | "height" | "onScroll" | "maxDate" | "locale"
    > {
  value?: RangeValueType<DateTime> | [string, string] | null;
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
  onReset?: () => void;
  onCalendarChange?: (dates: [start: DateTime | null, end: DateTime | null], dateStrings: [string, string], info?: BaseInfo) => void;
}

const DateRangePicker = (generateConfig: GenerateConfig<DateTime>) =>
  forwardRef<PickerRef, DateRangePickerProps>((props, ref) => {
    const {
      className,
      label,
      extraLabel,
      helpText,
      locale,
      required,
      localeLang,
      status,
      customPopupContainer,
      loading,
      customLoaderComponent,
      confirmDateLabel,
      direction = 'ltr',
      bordered = 'full',
      placement = 'topLeft',
      prefixCls = 'tecma-picker',
      dataTestId = 'tecma-dateRangePicker',
      allowClear = true,
      value,
      ...rest
    } = props;
    const mobileDateRangePickerProps: Partial<DateRangePickerMobileProps> = {
      confirmDateLabel: props.confirmDateLabel,
      resetDateLabel: props.resetDateLabel,
      placeholder: props.placeholder,
      mobileTitleLabel: props.mobileTitleLabel,
      mobileSubTitleLabel: props.mobileSubTitleLabel,
      formatDateOptions: props.formatDateOptions,
      localeMobileConfig: props.localeMobileConfig,
      minDate: props.minDate?.toJSDate(),
      maxDate: props.maxDate?.toJSDate(),
      minimumDays: props.minimumDays,
      onReset: props.onReset,
      onClose: props.onClose,
      onConfirm: props.onConfirm,
    };
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>(() => getCurrentViewMode(Number.parseInt(variables.tablet, 10)));

    const convertDateValuesFromIso = (
      newValue?: RangeValueType<DateTime> | [string, string] | null,
    ): RangeValueType<DateTime | null> | null => {
      if (newValue?.length && !newValue.every((e) => e === "")) {
        return newValue.map((e) => {
          if (typeof e === 'string') {
            return DateTime.fromISO(e);
          }
          return e;
        }) as [DateTime<boolean> | null, DateTime<boolean> | null];
      }
      return null;
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
            <div className={`tecma-picker-loader ${customLoaderComponent ? '' : 'traditional'}`}>
              {customLoaderComponent ?? <Spinner />}
            </div>
          ) : null}
        </>
      );
    };

    if (viewMode === 'mobile') {
      return (
        <DateRangePickerMobile
          value={convertDateValuesFromIso(value) as DateTime[] | undefined}
          ref={ref as unknown as Ref<InfiniteCalendar>}
          localeLang={localeLang}
          {...mobileDateRangePickerProps}
        />
      );
    }

    return (
      <div className="tecma-picker-wrapper" data-testid={dataTestId}>
        {label && (
          <span className="tecma-picker-label">
            {label}{" "}
            {extraLabel && <span className="tecma-picker-extra-label">{extraLabel}</span>}
            {required && "*"}
          </span>
        )}
        <RCRangePicker
          separator={
            <span aria-label='to' className='tecma-picker-separator'>
              -
            </span>
          }
          id='calendar'
          ref={ref as Ref<any> | undefined}
          placement={placement}
          popupAlign={transPlacement2DropdownAlign(direction, placement)}
          panelRender={panelRender}
          suffixIcon={<Icon size='small' iconName='calendar' />}
          allowClear={allowClear ? { clearIcon: <Icon size='small' iconName='x-circle' /> } : false}
          prevIcon={<span className='tecma-picker-prev-icon' />}
          nextIcon={<span className='tecma-picker-next-icon' />}
          superPrevIcon={<span className='tecma-picker-super-prev-icon' />}
          superNextIcon={<span className='tecma-picker-super-next-icon' />}
          transitionName='tecma-slide-up'
          className={classNames(
            {
              'tecma-picker-borderless': bordered === 'none',
              'tecma-picker-border-bottom': bordered === 'bottom',
            },
            getStatusClassNames(prefixCls, status),
            className,
          )}
          prefixCls={prefixCls}
          generateConfig={generateConfig}
          getPopupContainer={getPopupContainer}
          direction={direction}
          locale={localeConfig as Locale}
          value={convertDateValuesFromIso(value)}
          {...rest}
        />
        {helpText && <span className={`tecma-picker-help-text ${status ?? ""}`}>{helpText}</span>}
      </div>
    );
  });

export default DateRangePicker(luxonGenerateConfig);
