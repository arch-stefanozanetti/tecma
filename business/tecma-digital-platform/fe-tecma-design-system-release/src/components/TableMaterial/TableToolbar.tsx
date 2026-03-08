import * as React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { useDebounce } from '../../hooks/useDebounce';
import { Input } from '../Input';

import '../../styles/tableMaterial.scss';

// Required Props
interface TableToolbarRequiredProps {}

// Optional Props
interface TableToolbarOptionalProps extends DefaultProps {
  title?: string;
  search?: boolean;
  searchText?: string;
  onSearchChanged?: (search: string) => void;
  localization?: { searchPlaceholder: string };
  actions?: React.ReactNode;
}

// Combined required and optional props to build the full prop interface
export interface TableToolbarProps extends TableToolbarRequiredProps, TableToolbarOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: TableToolbarOptionalProps = {
  'data-testid': 'tecma-table-pagination',
};

const TableToolbar: React.FC<TableToolbarProps> = ({ title, search, searchText, onSearchChanged, className, localization, actions }) => {
  const classList = classNames('tecma-table-toolbar', className);
  const [searchQuery, setSearchQuery] = React.useState(searchText ?? '');
  const debouncedSearchQuery = useDebounce<string>(searchQuery, 500);

  React.useEffect(() => {
    if (debouncedSearchQuery !== searchText && onSearchChanged) {
      onSearchChanged(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, searchText, onSearchChanged]);

  return (
    <div className={classList}>
      {title && <h3 className='table-toolbar-title'>{title}</h3>}
      {search && (
        <Input
          onChange={(e) => setSearchQuery(e.target.value)}
          value={searchQuery}
          iconName='search'
          placeholder={localization?.searchPlaceholder}
        />
      )}
      <div className='actions-container'>{actions}</div>
    </div>
  );
};

TableToolbar.defaultProps = defaultProps as Partial<TableToolbarOptionalProps>;

export const createToolbar = (actions: React.ReactNode) => {
  return (props: TableToolbarProps) => <TableToolbar {...props} actions={actions} />;
};

export default React.memo(TableToolbar);
