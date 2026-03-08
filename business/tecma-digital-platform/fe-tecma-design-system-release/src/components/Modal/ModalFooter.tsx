import React, { ReactNode } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/modal.scss';

// Required Props
interface ModalFooterRequiredProps {}

// Optional Props
interface ModalFooterOptionalProps extends DefaultProps {
  children?: ReactNode;
  noWrapAndCenter?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface ModalFooterProps extends ModalFooterRequiredProps, ModalFooterOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: ModalFooterOptionalProps = {
  'data-testid': 'tecma-modal-footer',
  noWrapAndCenter: false,
};

const ModalFooter: React.FC<ModalFooterProps> = ({ className, children, style, noWrapAndCenter, ...rest }) => {
  const classList = classNames('tecma-modal-footer', className, { noWrapAndCenter });

  return (
    <div style={{ ...style }} className={classList} {...rest}>
      {children}
    </div>
  );
};

ModalFooter.defaultProps = defaultProps as Partial<ModalFooterOptionalProps>;

export default React.memo(ModalFooter);
