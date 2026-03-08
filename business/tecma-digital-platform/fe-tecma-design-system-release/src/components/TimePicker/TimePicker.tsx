import React, { useState, MouseEvent, ChangeEvent, memo, ReactNode, ChangeEventHandler } from 'react';
import classNames from 'classnames';
import { Input } from '../Input';
import { IconName } from '../Icon/IconName';
import { Button } from '../Button';
import { Divider } from '../Divider';
import { Popover } from '../Popover';
import '../../styles/timePicker.scss';
import { DefaultProps } from '../../declarations';
import { validateTimeInput } from '../../helpers/timeValidate';

interface TimePickerRequiredProps {
  onChange: ChangeEventHandler<HTMLInputElement>;
  onTimeSave: (time: string) => void;
  value: string;
}

interface TimePickerOptionalProps extends DefaultProps {
  saveButtonLabel?: string;
  // The input status
  status?: 'error' | 'warning';
  // The text to show when input is errored
  helpText?: ReactNode;
  // The icon to show
  iconName?: IconName;
  // The icon to show on the left
  leftIconName?: IconName;
  // The input placeholder
  placeholder?: string;
  // The input label
  label?: string;
  // The input label extra content
  extraLabel?: ReactNode;
  // The input required
  required?: boolean;
  // The input disabled
  disabled?: boolean;
}

export interface TimePickerProps extends TimePickerRequiredProps, TimePickerOptionalProps {}

const hours = Array.from({ length: 24 }, (_, i) => (i < 10 ? `0${i}` : `${i}`));
const minutes = ['00', '15', '30', '45'];

export const TimePicker = React.forwardRef<HTMLDivElement, TimePickerProps>(
  ({ className, onChange, saveButtonLabel = 'OK', leftIconName = 'clock', value, onTimeSave, disabled, ...inputProps }, ref) => {
    const classList = classNames('tecma-time-picker', className);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const time = validateTimeInput(value);
    const [selectedHour, selectedMinute] = time.split(':');

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e);
    };

    const handleOpenDropdown = (event: MouseEvent<HTMLElement>) => {
      if (disabled) return;
      setAnchorEl(event.currentTarget);
    };

    const handleClose = () => setAnchorEl(null);

    const handleSave = () => {
      onTimeSave(`${selectedHour}:${selectedMinute}`);
      handleClose();
    };

    const handleHourSelect = (hour: string) => {
      onTimeSave(`${hour}:${selectedMinute}`);
    };

    const handleMinuteSelect = (minute: string) => {
      onTimeSave(`${selectedHour}:${minute}`);
    };

    return (
      <div className={classList} ref={ref}>
        <Popover
          className='tecma-time-picker-popover'
          isOpen={Boolean(anchorEl)}
          onClose={handleClose}
          position={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          trigger={
            <div>
              <Input
                value={time}
                disabled={disabled}
                onClick={handleOpenDropdown}
                onChange={handleInputChange}
                leftIconName={leftIconName}
                {...inputProps}
              />
            </div>
          }
        >
          <div className='tecma-time-picker-dropdown-content'>
            <div className='tecma-time-picker-columns'>
              <div className='tecma-time-picker-hours'>
                {hours.map((hour) => (
                  <Button
                    key={hour}
                    onClick={() => handleHourSelect(hour)}
                    className={classNames('tecma-time-picker-time-item', {
                      selected: hour === selectedHour,
                    })}
                    color={hour === selectedHour ? 'secondary' : 'inverse'}
                    size='small'
                  >
                    {hour}
                  </Button>
                ))}
              </div>
              <Divider type='vertical' className='tecma-time-picker-vertical-divider' />
              <div className='tecma-time-picker-minutes'>
                {minutes.map((minute) => (
                  <Button
                    key={minute}
                    onClick={() => handleMinuteSelect(minute)}
                    className={classNames('tecma-time-picker-time-item', {
                      selected: minute === selectedMinute,
                    })}
                    color={minute === selectedMinute ? 'secondary' : 'inverse'}
                    size='small'
                  >
                    {minute}
                  </Button>
                ))}
              </div>
            </div>
            <div className='tecma-time-picker-footer'>
              <Button onClick={handleSave} className='tecma-time-picker-submit-button'>
                {saveButtonLabel}
              </Button>
            </div>
          </div>
        </Popover>
      </div>
    );
  },
);
