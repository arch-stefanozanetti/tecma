import * as React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { useDebounceFn } from '../../hooks/useDebounce';
import { Button } from '../Button';
import { ButtonProps } from '../Button/Button';
import { IconName } from '../Icon/IconName';

interface CarouselButtonRequiredProps extends ButtonProps {
  iconName: IconName;
  onClick: () => void;
}
interface CarouselButtonOptionalProps extends DefaultProps {}

export interface CarouselButtonProps extends CarouselButtonRequiredProps, CarouselButtonOptionalProps {}

const defaultProps: CarouselButtonOptionalProps = {
  'data-testid': 'carousel-button',
};

const CarouselButton: React.FC<CarouselButtonProps> = ({ iconName, className, disabled, onClick, ...rest }) => {
  const classList = classNames('carousel-button', className);

  return (
    <Button
      /* the onclick has been debounced to prevent wrong animation if user click compulsively */
      onClick={useDebounceFn(onClick, 250)}
      rounded
      className={classList}
      iconName={iconName}
      disabled={disabled}
      {...rest}
    />
  );
};

CarouselButton.defaultProps = defaultProps as Partial<CarouselButtonOptionalProps>;

export default CarouselButton;
