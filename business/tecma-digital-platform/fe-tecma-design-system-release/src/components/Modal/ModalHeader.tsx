import React, { ReactNode } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { Button } from '../Button';

// styles
import '../../styles/modal.scss';

// Required Props
interface ModalHeaderRequiredProps {
  onClose: React.MouseEventHandler<HTMLButtonElement>;
}

// Optional Props
interface ModalHeaderOptionalProps extends DefaultProps {
  title?: string;
  subtitle?: string;
  isBackgroundDark?: boolean;
  backgroundImage?: string;
  children?: ReactNode;
  closeIcon?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface ModalHeaderProps extends ModalHeaderRequiredProps, ModalHeaderOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: ModalHeaderOptionalProps = {
  'data-testid': 'tecma-modal-header',
};

const ModalHeader: React.FC<ModalHeaderProps> = ({
  className,
  children,
  closeIcon,
  onClose,
  title,
  subtitle,
  backgroundImage,
  isBackgroundDark,
  style,
  ...rest
}) => {
  const classList = classNames('tecma-modal-header', className, {
    closeIcon,
    'dark-background': backgroundImage && !children && isBackgroundDark,
  });

  const content = () => {
    if (children) {
      return children;
    }
    return (
      <div className='tecma-modal-header__content'>
        {title && <span className='tecma-modal-header__content__title'>{title}</span>}
        {subtitle && <span className='tecma-modal-header__content__subtitle'>{subtitle}</span>}
      </div>
    );
  };

  return (
    <div
      style={{
        ...style,
        backgroundImage: backgroundImage && !children ? `url(${backgroundImage})` : 'none',
      }}
      className={classList}
      {...rest}
    >
      {content()}
      {closeIcon && <Button iconName='x' className='tecma-modal-header__close-icon' onClick={onClose} color='transparent' />}
    </div>
  );
};

ModalHeader.defaultProps = defaultProps as Partial<ModalHeaderOptionalProps>;

export default React.memo(ModalHeader);
