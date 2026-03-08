import React from 'react';

import { DatesFormatter, DatesFormatterRange } from '../../helpers/datesFormatter';
import { Button } from '../Button';
import { Modal } from '../Modal';
import '../../styles/date-picker-mobile.scss';

export interface DatePickerMobileProps {
  isOpen: boolean;
  confirmLabel?: string;
  dateCountSelected?: number;
  resetLabel?: string;
  value?: Date | [Date | undefined, Date | undefined];
  placeholder?: string | [string, string];
  title?: string;
  subTitle?: string;
  localeLang: string;
  formatDateOptions?: Intl.DateTimeFormatOptions;
  triggerElement?: React.ReactNode;
  onDateClick?: () => void;
  onReset?: () => void;
  onClose?: () => void;
  onConfirm?: () => void;
}

const DatePickerMobileModal: React.FC<DatePickerMobileProps> = ({
  isOpen,
  title,
  subTitle,
  value,
  placeholder,
  confirmLabel = 'Confirm',
  resetLabel = 'Reset',
  dateCountSelected,
  localeLang,
  formatDateOptions,
  onDateClick,
  children,
  onReset,
  onClose,
  onConfirm,
  triggerElement,
}) => {
  const getDateSelected = () => {
    return Array.isArray(value) ? [value?.[0], value?.[1]] : value ?? false;
  };

  const dateSelected = getDateSelected();

  const handleOnReset = () => {
    if (onReset) {
      onReset();
    }
  };

  const handleOnClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleOnConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
  };

  const getDateFormatted = () => {
    if (dateSelected) {
      if (Array.isArray(dateSelected)) {
        if (dateSelected[0] && dateSelected[1]) {
          return DatesFormatterRange(dateSelected[0], dateSelected[1], formatDateOptions, localeLang);
        }
        return placeholder;
      }
      return DatesFormatter(dateSelected, formatDateOptions, localeLang);
    }
    return placeholder;
  };

  const getDisabledState = () => {
    if (Array.isArray(dateSelected)) {
      if (dateCountSelected && dateCountSelected < 2) {
        return true;
      }
      return !!(!dateSelected[0] || !dateSelected[1]);
    }
    return !dateSelected;
  };

  return (
    <>
      {triggerElement ? (
        React.cloneElement(triggerElement as React.ReactElement, {
          onClick: onDateClick,
        })
      ) : (
        <Button className='date-picker-mobile-button' color='inverse' outlined onClick={onDateClick ? onDateClick : () => {}}>
          {getDateFormatted()}
        </Button>
      )}
      <Modal className='date-picker-mobile-modal' isOpen={isOpen} onClose={handleOnClose}>
        <Modal.Header className='date-picker-mobile-modal__header' closeIcon title={title} subtitle={subTitle} onClose={handleOnClose} />
        <Modal.Content className='date-picker-mobile-modal__content'>{children}</Modal.Content>
        <Modal.Footer className='date-picker-mobile-modal__footer'>
          <Button disabled={getDisabledState()} onClick={handleOnConfirm} fluid rounded>
            {confirmLabel}
          </Button>
          <Button disabled={getDisabledState()} onClick={handleOnReset} fluid color='inverse' rounded>
            {resetLabel}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default DatePickerMobileModal;
