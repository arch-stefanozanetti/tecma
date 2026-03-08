import React, { memo } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { Button } from '../Button';

interface DropDownItemRequiredProps {
  children: React.ReactNode | string;
  onClick: () => void;
}
interface DropDownItemOptionalProps extends DefaultProps {}

export interface DropDownItemProps extends DropDownItemRequiredProps, DropDownItemOptionalProps {}

const defaultProps: DropDownItemOptionalProps = {
  'data-testid': 'tecma-dropDown-item',
};

const DropDownItem: React.FC<DropDownItemProps> = ({ children, id, style, className, onClick, ...rest }) => {
  const classList = classNames('tecma-dropDown-item', className);

  return (
    <li id={id} style={style} className={classList} {...rest}>
      <Button onClick={onClick} fluid color='transparent'>
        {children}
      </Button>
    </li>
  );
};

DropDownItem.defaultProps = defaultProps as Partial<DropDownItemOptionalProps>;

export default memo(DropDownItem);
