import React, { Children, cloneElement, ReactElement, TouchEventHandler, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import CarouselButton from './CarouselButton';
import { CarouselItem, CarouselPagination } from './components';
import { calculateStyle } from './utils/calculateStyle';
import { groupArray } from './utils/groupArray';
import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/carousel.scss';

// Required Props
interface CarouselRequiredProps {}

// Optional Props
interface CarouselOptionalProps extends DefaultProps {
  children?: React.ReactNode[];
  buttons?: React.ReactNode;
  slidesPerView?: number;
  showPagination?: boolean;
  centeredSlides?: boolean;
  slideClassName?: string;
  sliderClassName?: string;
  width?: string;
  selectedItemIndex: number;
  loop?: boolean;
  onChange?: (index: number, item: React.ReactNode) => void;
  swipe?: {
    next: () => void;
    prev: () => void;
  };
  slidesGap?: number;
}

// Combined required and optional props to build the full prop interface
export interface CarouselProps extends CarouselRequiredProps, CarouselOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: CarouselOptionalProps = {
  'data-testid': 'tecma-carousel',
  style: {},
  children: [],
  className: '',
  showPagination: true,
  slideClassName: '',
  sliderClassName: '',
  slidesPerView: 1,
  centeredSlides: false,
  width: '100%',
  selectedItemIndex: 0,
  onChange: () => {},
  loop: true,
};

const SWIPE_PIXEL_THRESHOLD = 5;

const Carousel: React.FC<CarouselProps> = ({
  className,
  children,
  buttons,
  style,
  showPagination,
  slidesPerView,
  centeredSlides,
  slideClassName,
  sliderClassName,
  width,
  selectedItemIndex,
  onChange,
  loop,
  swipe = {
    prev: () => {},
    next: () => {},
  },
  slidesGap,
  ...rest
}) => {
  const { prev, next } = swipe;
  const carouselWrapperRef = useRef<HTMLDivElement>(null);
  const [touchPosition, setTouchPosition] = useState<number | null>(null);
  /*
   * create a copy of component children in order to manipulate the array without touching the incoming props
   * the array manipulation is required when the carousel show more than a slide per time
   */
  const nextChildren = children?.map((i) => cloneElement(i as ReactElement));
  /**
   * The groupChildrenArray return children as is if slidesPerView === 1
   * else it will group the slides based on slidesPerView value
   */
  const groupChildrenArray = groupArray(nextChildren as [React.ReactElement], slidesPerView as number);

  useEffect(() => {
    if (onChange) {
      onChange(selectedItemIndex, Children.toArray(children)[selectedItemIndex]);
    }
  }, [centeredSlides, children, onChange, selectedItemIndex, slidesPerView]);

  const changeItem = (newIndex: number) => () => {
    if (onChange) {
      onChange(newIndex, Children.toArray(children)[newIndex]);
    }
  };

  const handleTouchStart: TouchEventHandler<HTMLDivElement> = (e) => {
    const touchDown = e.touches[0].clientX;
    setTouchPosition(touchDown);
  };

  const handleTouchMove: TouchEventHandler<HTMLDivElement> = (e) => {
    const touchDown = touchPosition;

    if (touchDown === null) {
      return;
    }

    const currentTouch = e.touches[0].clientX;
    const diff = touchDown - currentTouch;

    if (diff > SWIPE_PIXEL_THRESHOLD && next) {
      next();
    }

    if (diff < -SWIPE_PIXEL_THRESHOLD && prev) {
      prev();
    }

    setTouchPosition(null);
  };

  const classContainerList = classNames('tecma-carousel', className);
  const classSliderList = classNames('slider', sliderClassName);
  const wrapperClassList = classNames('slider-wrapper', { centered: centeredSlides, loop });

  return (
    <div
      className={classContainerList}
      ref={carouselWrapperRef}
      {...rest}
      style={{ ...style }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div className={wrapperClassList}>
        <ul className={classSliderList}>
          {groupChildrenArray &&
            groupChildrenArray.map((item: unknown, index: number) => (
              <CarouselItem
                // eslint-disable-next-line react/no-array-index-key
                key={`itemKey${index}`}
                className={slideClassName}
                selected={index === selectedItemIndex}
                previous={
                  selectedItemIndex === groupChildrenArray.length - 1
                    ? index !== 0 && index === selectedItemIndex - 1
                    : index === selectedItemIndex - 1
                }
                next={selectedItemIndex === groupChildrenArray.length - 1 ? index === 0 : index === selectedItemIndex + 1}
                style={{
                  ...calculateStyle(index, selectedItemIndex, loop, centeredSlides, children?.length, slidesGap),
                }}
              >
                {Children.map(item, (child) => child)}
              </CarouselItem>
            ))}
        </ul>
      </div>
      <div className='carousel-buttons-container'>{buttons}</div>
      {showPagination && (
        <CarouselPagination itemsNumber={groupChildrenArray.length} onClick={changeItem} selectedItemIndex={selectedItemIndex} />
      )}
    </div>
  );
};

Carousel.defaultProps = defaultProps as Partial<CarouselOptionalProps>;

const CarouselExport = Object.assign(React.memo(Carousel), {
  Button: CarouselButton,
});

export default CarouselExport;
