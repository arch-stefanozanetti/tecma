/* eslint-disable @typescript-eslint/no-unused-expressions */
import React, { MouseEventHandler, ReactNode, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import ModalContent from './ModalContent';
import ModalFooter from './ModalFooter';
import { DefaultProps } from '../../declarations/defaultProps';
import { VerticalPosition } from '../../declarations/position';
import { SizeStandard } from '../../declarations/size';
import { Portal } from '../_Portal';

// subcomponents
import ModalHeader from './ModalHeader';
// styles
import variables from '../../styles/theme/variables.module.scss';
import '../../styles/modal.scss';

// Required Props
interface ModalRequiredProps {
  isOpen: boolean;
  onClose: () => void;
}

// Optional Props
interface ModalOptionalProps extends DefaultProps {
  children?: ReactNode;
  closeOnBackDropClick?: boolean;
  width?: number;
  verticalPosition?: VerticalPosition;
  size?: SizeStandard;
  disabledMobileAnimation?: boolean;
  disableBackdropBackground?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface ModalProps extends ModalRequiredProps, ModalOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: ModalOptionalProps = {
  'data-testid': 'tecma-modal',
  className: undefined,
  verticalPosition: 'center',
  style: undefined,
};

/**
 * A modal is an interface element that appears over other content. It requires an interaction from the user before they can return to whatever is underneath.
 */
const Modal: React.FC<ModalProps> = ({
  className,
  children,
  isOpen,
  onClose,
  closeOnBackDropClick,
  verticalPosition,
  size,
  width,
  style,
  disabledMobileAnimation,
  disableBackdropBackground,
  ...rest
}) => {
  const classList = classNames('tecma-modal', className, {
    [`${size}`]: size,
  });

  const containerClassList = classNames('tecma-modal-container', {
    [`${verticalPosition}`]: verticalPosition,
    isOpen,
    'disable-mobile-animation': disabledMobileAnimation,
    'disable-backdrop-background': disableBackdropBackground,
  });
  const widthStyle = width && { width: `${width}rem` };
  const modalBackDrop = useRef<HTMLDivElement>(null);

  const onBackDropClick: MouseEventHandler<HTMLDivElement> = (e) => {
    if (!closeOnBackDropClick) {
      return;
    }
    if (e.target === modalBackDrop.current) {
      onClose();
    }
  };

  const [shouldRender, setRender] = useState<boolean>(isOpen);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setRender(true);
    }
    if (!isOpen) {
      document.body.style.overflow = 'unset';
      if (window.innerWidth > Number.parseInt(variables.tablet, 10)) {
        setRender(false);
      }
    }
  }, [isOpen]);

  const onAnimationEnd = () => {
    if (!isOpen) setRender(false);
  };

  return (
    <Portal id='tecma-floatingModal'>
      {shouldRender && (
        <div className={containerClassList} {...rest} aria-hidden='true' onClick={onBackDropClick} ref={modalBackDrop}>
          <div
            style={{
              ...style,
              ...widthStyle,
            }}
            className={classList}
            onAnimationEnd={onAnimationEnd}
          >
            {children}
          </div>
        </div>
      )}
    </Portal>
  );
};

Modal.defaultProps = defaultProps as Partial<DefaultProps>;

const ModalSpace = Object.assign(Modal, {
  Header: ModalHeader,
  Footer: ModalFooter,
  Content: ModalContent,
});

export { ModalSpace as Modal };
