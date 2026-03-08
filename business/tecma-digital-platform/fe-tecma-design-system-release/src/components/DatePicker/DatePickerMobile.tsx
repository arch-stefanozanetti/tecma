import React, { forwardRef, useMemo, useState } from 'react';

import { DateTime } from 'luxon';
import InfiniteCalendar, { type ReactInfiniteCalendarProps, type DateSelectFunction } from 'react-infinite-calendar';

import { LocaleMobileConfig } from '../../declarations';
import { getDateFnsLocale } from '../../helpers/dateFns';
import DatePickerMobileModal from '../DatePickerMobileModal';

export interface DatePickerMobileProps extends ReactInfiniteCalendarProps {
  confirmDateLabel?: string;
  resetDateLabel?: string;
  value?: DateTime<boolean> | string;
  placeholder?: string;
  mobileTitleLabel?: string;
  mobileSubTitleLabel?: string;
  localeLang: string;
  formatDateOptions?: Intl.DateTimeFormatOptions;
  localeMobileConfig?: LocaleMobileConfig;
  triggerElement?: React.ReactNode;
  onReset?: () => void;
  onClose?: () => void;
  onConfirm?: (date: Date) => void;
}

const convertDateValueFromIso = (date?: DateTime | string): DateTime | undefined => {
  if (date) {
    return typeof date === 'string' ? DateTime.fromISO(date) : date;
  }
  return undefined;
};

const DatePickerMobile = forwardRef<InfiniteCalendar, DatePickerMobileProps>(
  (
    {
      mobileTitleLabel,
      mobileSubTitleLabel,
      confirmDateLabel,
      resetDateLabel,
      value,
      placeholder = 'Check-in',
      localeLang,
      localeMobileConfig,
      formatDateOptions,
      minDate,
      maxDate,
      disabledDates,
      disabledDays,
      triggerElement,
      onReset,
      onClose,
      onConfirm,
    },
    ref,
  ) => {
    const convertedValue = convertDateValueFromIso(value);
    const [currentDate, setCurrentDate] = useState<Date | undefined>(convertedValue ? convertedValue.toJSDate() : undefined);
    const [date, setDate] = useState<Date | undefined>(convertedValue ? convertedValue.toJSDate() : undefined);
    const [isOpen, setIsOpen] = useState(false);
    const localeConfig = useMemo(() => getDateFnsLocale(localeLang, localeMobileConfig), [localeLang, localeMobileConfig]);
    const handleOnReset = () => {
      setCurrentDate(undefined);
      if (onReset) {
        onReset();
      }
    };

    const handleOnClose = () => {
      setCurrentDate(date);
      if (onClose) {
        onClose();
      }
      setIsOpen(false);
    };

    const handleOnConfirm = () => {
      setDate(currentDate);
      if (onConfirm) {
        onConfirm(currentDate as Date);
      }
      setIsOpen(false);
    };

    const handleOnSelect: DateSelectFunction = (dateSelected) => {
      setCurrentDate(dateSelected);
    };

    return (
      <DatePickerMobileModal
        value={currentDate}
        isOpen={isOpen}
        onDateClick={() => setIsOpen(true)}
        onConfirm={handleOnConfirm}
        onReset={handleOnReset}
        onClose={handleOnClose}
        localeLang={localeLang}
        placeholder={placeholder}
        formatDateOptions={formatDateOptions}
        title={mobileTitleLabel}
        subTitle={mobileSubTitleLabel}
        confirmLabel={confirmDateLabel}
        resetLabel={resetDateLabel}
        triggerElement={triggerElement}
      >
        <InfiniteCalendar
          ref={ref}
          selected={currentDate ?? false}
          onSelect={handleOnSelect}
          width={window.innerWidth}
          height={window.innerHeight}
          displayOptions={{ showMonthsForYears: false }}
          disabledDays={disabledDays}
          disabledDates={disabledDates}
          locale={localeConfig}
          minDate={minDate}
          maxDate={maxDate}
        />
      </DatePickerMobileModal>
    );
  },
);

export default DatePickerMobile;
