import React from 'react';

import classNames from 'classnames';

interface CarouselPaginationProps {
  selectedItemIndex: number;
  itemsNumber: number;
  onClick: (newIndex: number) => (e: React.MouseEvent | React.KeyboardEvent) => void;
}

const CarouselPagination: React.FC<CarouselPaginationProps> = ({ selectedItemIndex, itemsNumber, onClick }) => {
  return (
    <div className='control-dots'>
      {Array(itemsNumber)
        .fill(0)
        .map((_, index) => {
          const isSelected = index === selectedItemIndex;
          const key = `${_}${index}`;
          const ariaLabel = `image item ${index + 1}`;
          const dotClassName = classNames('dot', isSelected && 'selected');
          return <button type='button' key={key} onClick={onClick(index)} className={dotClassName} aria-label={ariaLabel} />;
        })}
    </div>
  );
};

export default CarouselPagination;
