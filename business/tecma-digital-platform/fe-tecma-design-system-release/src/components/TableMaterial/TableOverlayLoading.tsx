import * as React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { Spinner } from '../Spinner';

// styles
import '../../styles/tableMaterial.scss';

// Required Props
interface TableOverlayLoadingRequiredProps {}

// Optional Props
interface TableOverlayLoadingOptionalProps extends DefaultProps {}

// Combined required and optional props to build the full prop interface
export interface TableOverlayLoadingProps extends TableOverlayLoadingRequiredProps, TableOverlayLoadingOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: TableOverlayLoadingOptionalProps = {
  'data-testid': 'tecma-table-overlay-loading',
};

const TableOverlayLoading: React.FC<TableOverlayLoadingProps> = ({ className, ...rest }) => {
  const classList = classNames('tecma-table-overlay-loading', className);

  return (
    <div className={classList} {...rest}>
      <Spinner type='dotted-circle' size='large' />
    </div>
  );
};

TableOverlayLoading.defaultProps = defaultProps as Partial<TableOverlayLoadingOptionalProps>;

export default React.memo(TableOverlayLoading);
