import React, { ReactNode } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';

// Required Props
interface GridColumnRequiredProps {}

type ColumnWidth =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12;

// Optional Props
interface GridColumnOptionalProps extends DefaultProps {
  // Accepts a value from 1 to 12 to define the column width
  size?: ColumnWidth;
  // Accepts a value from 1 to 12 to define the column margin-left
  offset?: ColumnWidth | null;
  children?: HTMLElement | ReactNode;
}

// Combined required and optional props to build the full prop interface
export interface GridColumnProps extends GridColumnRequiredProps, GridColumnOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: GridColumnOptionalProps = {
  'data-testid': 'tecma-gridColumn',
  size: 12,
  offset: null,
};

const GridColumn: React.FC<GridColumnProps> = ({ size, offset, className, children, ...rest }) => {
  const classList = classNames(
    'tecma-grid-column',
    {
      [`col-${size}`]: size,
    },
    {
      [`offset-${offset}`]: offset,
    },
    className,
  );
  return (
    <div className={classList} {...rest}>
      {children}
    </div>
  );
};

GridColumn.defaultProps = defaultProps as Partial<GridColumnOptionalProps>;

export default React.memo(GridColumn);
