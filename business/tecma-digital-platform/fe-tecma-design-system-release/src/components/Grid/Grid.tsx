import React, { Children, cloneElement, ReactElement } from 'react';

import classNames from 'classnames';

import GridColumn from './GridColumn';
import { DefaultProps } from '../../declarations';

// styles
import '../../styles/grid.scss';

// Required Props
interface GridRequiredProps {}

// Optional Props
interface GridOptionalProps extends DefaultProps {
  // Space between column, should be set to (16 + 8n) px (n stands for natural number).
  gutter?: number;
  // Defines the position of the column along the grid's cross axis.
  itemsAlign?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
}

// Combined required and optional props to build the full prop interface
export interface GridProps extends GridRequiredProps, GridOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: GridOptionalProps = {
  'data-testid': 'tecma-grid',
  itemsAlign: 'center',
};

const Grid: React.FC<GridProps> = ({ gutter, itemsAlign, children, className, ...rest }) => {
  const classList = classNames('tecma-grid', { [`${itemsAlign}`]: itemsAlign }, className);
  const columnStyle = gutter ? { paddingLeft: `${gutter / 2}px`, paddingRight: `${gutter / 2}px` } : '';

  return (
    <div className={classList} {...rest}>
      {Children.map(children, (child) => cloneElement(child as ReactElement, { style: { ...columnStyle } }))}
    </div>
  );
};

Grid.defaultProps = defaultProps as Partial<GridOptionalProps>;

const GridSpace = Object.assign(Grid, {
  Column: GridColumn,
});

export { GridSpace as Grid };
