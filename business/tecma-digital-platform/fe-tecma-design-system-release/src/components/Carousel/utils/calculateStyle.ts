export const calculateStyle = (
  itemIndex: number,
  selectedItemIndex: number,
  loop: boolean | undefined,
  centered: boolean | undefined,
  childrenLength: number | undefined,
  slidesGap = 0,
) => {
  if (selectedItemIndex === itemIndex) {
    return { transform: `translateX(${-selectedItemIndex * 100}%)` };
  }

  const nextSlide = {
    transform: `translateX(calc(${-selectedItemIndex * 100}% + ${slidesGap}rem))`,
    opacity: loop ? 0 : 1,
  };
  const prevSlide = {
    transform: `translateX(calc(${-selectedItemIndex * 100}% - ${slidesGap}rem))`,
    opacity: loop ? 0 : 1,
  };

  const lastSlide = {
    transform: `translateX(calc(-${(itemIndex + 1) * 100}% - ${slidesGap}rem))`,
    opacity: 0,
  };
  const firstSlide = {
    transform: `translateX(calc(${(itemIndex + 1) * 100}% + ${slidesGap}rem))`,
    opacity: 0,
  };

  if (loop && childrenLength) {
    if (centered) {
      if (itemIndex === selectedItemIndex + 1) {
        return {
          ...nextSlide,
          opacity: 1,
        };
      }
      if (itemIndex === selectedItemIndex - 1) {
        return {
          ...prevSlide,
          opacity: 1,
        };
      }
      if (selectedItemIndex === 0 && itemIndex === childrenLength - 1) {
        return { ...lastSlide, opacity: 1 };
      }
      if (selectedItemIndex === childrenLength - 1 && itemIndex === 0) {
        return { ...firstSlide, opacity: 1 };
      }
    }
    if (selectedItemIndex === 0 && itemIndex === childrenLength - 1) {
      return lastSlide;
    }
    if (selectedItemIndex === childrenLength - 1 && itemIndex === 0) {
      return firstSlide;
    }
  }
  /* TODO: fix the animation for loop centered */
  return itemIndex > selectedItemIndex ? nextSlide : prevSlide;
};
