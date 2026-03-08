import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { Divider } from '../Divider';

// styles
import '../../styles/card.scss';

type DataItem = { label: string; value: number | string };

// Required Props
interface CardTableRequiredProps {
  // An array of object to show as table.
  data: DataItem[];
}

// Optional Props
interface CardTableOptionalProps extends DefaultProps {
  // If true, it will show a divider between rows
  dividerBetweenRows?: boolean;
  // If true, it will show a divider only before the last row
  dividerAtTheEnd?: boolean;
}

// use the optional prop interface to define the default props
const defaultProps: CardTableOptionalProps = {
  'data-testid': 'tecma-card-content',
  className: undefined,
  style: undefined,
  dividerBetweenRows: false,
  dividerAtTheEnd: false,
};
// Combined required and optional props to build the full prop interface
export interface CardTableProps extends CardTableRequiredProps, CardTableOptionalProps {}

const CardTable: React.FC<CardTableProps> = ({ data, dividerBetweenRows, dividerAtTheEnd, className, style, ...rest }) => {
  const classList = classNames('tecma-card-table', className);
  return (
    <div className={classList} style={style} {...rest}>
      {data.map((item: DataItem, index: number) => (
        <div key={item.label}>
          <div className='table-row'>
            <span className='row-label'>{item.label}</span>
            <span className='row-value'>{item.value}</span>
          </div>
          {dividerBetweenRows && index !== data.length - 1 && <Divider />}
          {dividerAtTheEnd && index === data.length - 2 && <Divider />}
        </div>
      ))}
    </div>
  );
};

CardTable.defaultProps = defaultProps as Partial<CardTableOptionalProps>;

export default React.memo(CardTable);
