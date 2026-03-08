import React, { CSSProperties, ReactNode } from 'react';

import classNames from 'classnames';

interface CarouselItemProps {
  children: ReactNode;
  className?: string;
  selected: boolean;
  previous: boolean;
  next: boolean;
  style: CSSProperties;
}

const CarouselItem = React.forwardRef<HTMLLIElement, CarouselItemProps>(({ className, selected, previous, next, children, style }, ref) => {
  const slideClassList = classNames('slide', className, {
    selected,
    previous,
    next,
  });

  return (
    <li className={slideClassList} style={style} ref={ref}>
      {children}
    </li>
  );
});

CarouselItem.defaultProps = {
  className: '',
};

export default CarouselItem;
