import React, { memo } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';

export interface DropDownDividerProps extends DefaultProps {}

const defaultProps: DropDownDividerProps = {
  'data-testid': 'tecma-dropDown-divider',
};

const DropDownDivider: React.FC<DropDownDividerProps> = ({ className, style, ...rest }) => {
  const classList = classNames('tecma-dropDown-divider', className);
  return <div className={classList} style={style} {...rest} />;
};

DropDownDivider.defaultProps = defaultProps as Partial<DropDownDividerProps>;

export default memo(DropDownDivider);
