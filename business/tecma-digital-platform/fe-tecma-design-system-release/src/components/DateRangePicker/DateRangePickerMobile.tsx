import React, { forwardRef, useState, useMemo } from 'react';

import { DateTime } from 'luxon';
import InfiniteCalendar, {
  withRange,
  Calendar,
  type ReactInfiniteCalendarProps,
  type RangedSelectFunction,
  EVENT_TYPE,
} from 'react-infinite-calendar';

import { LocaleMobileConfig } from '../../declarations';
import { getDateFnsLocale } from '../../helpers/dateFns';
import DatePickerMobileModal from '../DatePickerMobileModal';

export interface DateRangePickerMobileProps extends ReactInfiniteCalendarProps {
  confirmDateLabel?: string;
  resetDateLabel?: string;
  value?: DateTime<boolean>[];
  placeholder?: [string, string];
  mobileTitleLabel?: string;
  mobileSubTitleLabel?: string;
  minimumDays?: number;
  localeLang: string;
  formatDateOptions?: Intl.DateTimeFormatOptions;
  localeMobileConfig?: LocaleMobileConfig;
  onReset?: () => void;
  onClose?: () => void;
  onConfirm?: (dates: [Date, Date]) => void;
}

const CalendarWithRange = withRange(Calendar);

const DateRangePickerMobile = forwardRef<InfiniteCalendar, DateRangePickerMobileProps>(
  (
    {
      mobileTitleLabel,
      mobileSubTitleLabel,
      value,
      placeholder = 'Check-in/Check-out',
      confirmDateLabel,
      resetDateLabel,
      localeLang,
      localeMobileConfig,
      formatDateOptions,
      minDate,
      maxDate,
      minimumDays,
      disabledDays,
      disabledDates,
      onReset,
      onClose,
      onConfirm,
    },
    ref,
  ) => {
    const [dateCountSelected, setDateCountSelected] = useState(0);
    const [currentDates, setCurrentDates] = useState<[Date | undefined, Date | undefined] | undefined>(
      value ? [value?.[0]?.toJSDate() ?? undefined, value?.[1]?.toJSDate() ?? undefined] : undefined,
    );
    const [dates, setDates] = useState<[Date | undefined, Date | undefined] | undefined>(
      value ? [value?.[0]?.toJSDate() ?? undefined, value?.[1]?.toJSDate() ?? undefined] : undefined,
    );
    const [isOpen, setIsOpen] = useState(false);
    const localeConfig = useMemo(() => getDateFnsLocale(localeLang, localeMobileConfig), [localeLang, localeMobileConfig]);

    const handleOnReset = () => {
      setCurrentDates(undefined);
      setDateCountSelected(0);
      if (onReset) {
        onReset();
      }
    };

    const handleOnClose = () => {
      setCurrentDates(dates);
      if (onClose) {
        onClose();
      }
      setIsOpen(false);
    };

    const handleOnConfirm = () => {
      setDates(currentDates);
      if (onConfirm) {
        onConfirm(currentDates as [Date, Date]);
      }
      setIsOpen(false);
    };

    const handleOnSelect: RangedSelectFunction = ({ start, end, eventType }) => {
      if ([EVENT_TYPE.START, EVENT_TYPE.END].includes(eventType)) {
        if (dateCountSelected >= 2) {
          setDateCountSelected(1);
        } else {
          setDateCountSelected((curr) => curr + 1);
        }
      }
      setCurrentDates([start, end]);
      /* if (onCalendarChange) {
        const startDate = DateTime.fromJSDate(start);
        const endDate = DateTime.fromJSDate(end);
        onCalendarChange(
          [startDate, endDate],
          [startDate?.toLocaleString() ?? "", endDate?.toLocaleString() ?? ""],
        );
      } */
    };

    const getMinDate = () => {
      if (!!minimumDays && currentDates?.[0]) return DateTime.fromJSDate(currentDates[0]).plus({ days: minimumDays }).toJSDate();
      return minDate;
    };

    return (
      <DatePickerMobileModal
        value={currentDates}
        isOpen={isOpen}
        dateCountSelected={dateCountSelected}
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
      >
        <InfiniteCalendar
          ref={ref}
          Component={CalendarWithRange}
          selected={
            currentDates
              ? {
                  start: currentDates?.[0] as Date,
                  end: currentDates?.[1] ?? (currentDates?.[0] as Date),
                }
              : false
          }
          width={window.innerWidth}
          height={window.innerHeight}
          onSelect={handleOnSelect}
          disabledDays={disabledDays}
          disabledDates={disabledDates}
          displayOptions={{
            showMonthsForYears: false,
          }}
          locale={localeConfig}
          minDate={getMinDate()}
          maxDate={maxDate}
        />
      </DatePickerMobileModal>
    );
  },
);

export default DateRangePickerMobile;
