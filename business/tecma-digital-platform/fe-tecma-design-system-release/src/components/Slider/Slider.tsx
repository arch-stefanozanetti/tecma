import React, { useState, useRef } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/slider.scss';

// Required Props
interface SliderRequiredProps {
  // A number used to set the slider pointer position
  value: number;
}

// Optional Props
interface SliderOptionalProps extends DefaultProps {
  // A callback to perform on mouseDown
  onMouseDown?: () => void;
  // A callback to perform on mouseUp
  onMouseUp?: () => void;
  // If true, the slider is disabled
  disabled?: boolean;
  // A label to show on slider's top
  label?: string;
  // A text to show as help
  helpText?: string;
  // If true, the slider is on error
  error?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface SliderProps extends SliderRequiredProps, SliderOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: SliderOptionalProps = {
  'data-testid': 'tecma-slider',
  disabled: false,
};

const Slider: React.FC<SliderProps> = ({ value, onMouseDown, onMouseUp, disabled, className, label, helpText, error, ...rest }) => {
  const classList = classNames('tecma-slider', { disabled }, className);
  const sliderRef = useRef<HTMLDivElement>(null);
  // 8 to avoid the pointer go outside the progress bar. 8 is half of the pointer diameter
  const [nextPointerPosition, setNextPointerPosition] = useState<number>(value === 0 ? 8 : value);
  /**
   *  isProgressBarClicked boolean value indicates if the progress bar has been clicked or not
   */
  const isProgressBarClicked = useRef<boolean>(false);

  const handleOnMouseMove = (e: React.MouseEvent) => {
    if (sliderRef.current) {
      const { width, left } = sliderRef.current.getBoundingClientRect();

      const movement = e.pageX - left + 8;
      if (isProgressBarClicked.current === true && movement <= width + 8 && movement > 8) {
        setNextPointerPosition(movement);
        if (onMouseDown) {
          onMouseDown();
        }
      }
    }
  };
  const handleOnMouseDown = (e: React.MouseEvent) => {
    isProgressBarClicked.current = true;
    handleOnMouseMove(e);
  };

  const handleOnMouseUp = () => {
    if (isProgressBarClicked.current) {
      isProgressBarClicked.current = false;
      if (onMouseUp) {
        onMouseUp();
      }
    }
  };
  return (
    <div className='tecma-slider-container'>
      {label && <span className='slider-label'>{label}</span>}
      <div
        className={classList}
        onMouseDown={handleOnMouseDown}
        onMouseMove={handleOnMouseMove}
        onMouseUp={handleOnMouseUp}
        onMouseLeave={handleOnMouseUp}
        ref={sliderRef}
        role='presentation'
        {...rest}
      >
        <div className='slider-container' style={{ width: `${nextPointerPosition}px` }}>
          <div className='slider-pointer' />
        </div>
      </div>
      {helpText && <span className={error ? 'slider-helpText slider-helpText-errored' : 'slider-helpText'}>{helpText}</span>}
    </div>
  );
};

Slider.defaultProps = defaultProps as Partial<SliderOptionalProps>;

/**
 * A form control for choosing a value within a preset range of values.
 */
export default React.memo(Slider);
