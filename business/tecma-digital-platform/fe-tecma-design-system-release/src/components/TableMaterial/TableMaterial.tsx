import React, { useState, ReactNode } from 'react';

import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TableSortLabel } from '@mui/material';
import classNames from 'classnames';

import TableOverlayLoading from './TableOverlayLoading';
import TablePagination from './TablePagination';
import TableToolbar from './TableToolbar';

import type { DefaultProps } from '../../declarations';

// styles
import '../../styles/tableMaterial.scss';

interface Data {
  [key: string]: any;
}

interface Column {
  field: string;
  title: string | ReactNode;
  render?: (row: Data) => ReactNode;
  sort?: boolean;
}

// Required Props
interface TableMaterialRequiredProps {
  data: Data[];
  columns: Column[];
}

// Optional Props
interface TableMaterialOptionalProps extends DefaultProps {
  isLoading?: boolean;
  page?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  totalCount?: number;
  totalPages?: number;
  useBackendPagination?: boolean;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (columnField: string, direction?: 'asc' | 'desc') => void;
  onChangePage?: (newPage: number) => void;
  onChangeRowsPerPage?: (newPageSize: number) => void;
  toolbarActions?: ReactNode;
  title?: string;
  emptyDataLabel?: string | ReactNode;
  pageSizeLabel?: string;
  showPagination?: boolean;
  totalCountLabel?: ReactNode;
  showFirstLastButtons?: boolean;
  arrowVariant?: 'default' | 'flat';
  showRange?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface TableMaterialProps extends TableMaterialRequiredProps, TableMaterialOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: TableMaterialOptionalProps = {
  'data-testid': 'tecma-tableMaterial',
};

const sortData = (tableData: Data[], columnField: string, direction?: 'asc' | 'desc') => {
  if (!direction || !tableData) return tableData;
  return [...tableData].sort((a, b) => {
    const isAscending = direction === 'asc';
    const aValue = a[columnField];
    const bValue = b[columnField];
    if (aValue < bValue) return isAscending ? -1 : 1;
    if (aValue > bValue) return isAscending ? 1 : -1;
    return 0;
  });
};

const TableMaterial: React.FC<TableMaterialProps> = ({
  className,
  columns,
  data,
  isLoading = false,
  page = 0,
  pageSize = 5,
  pageSizeOptions = [5, 10, 20],
  totalCount,
  totalPages,
  sortDirection,
  title,
  toolbarActions,
  emptyDataLabel = 'No data :(',
  pageSizeLabel = '/ page',
  showPagination = true,
  onSortChange,
  onChangePage,
  onChangeRowsPerPage,
  useBackendPagination = true,
  totalCountLabel,
  showFirstLastButtons = false,
  arrowVariant = 'default',
  showRange = false,
  ...rest
}) => {
  const classList = classNames('tecma-table-material', className);
  const [internalPage, setPage] = useState(page);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortColumnDirection, setSortColumnDirection] = useState<'asc' | 'desc' | undefined>(sortDirection);

  const sortedData = sortData(data, sortColumn, sortColumnDirection);
  const filteredData = sortedData.slice(internalPage * rowsPerPage, internalPage * rowsPerPage + rowsPerPage);
  const tableData = useBackendPagination ? data : filteredData;

  const handleSortChange = (columnField: string) => {
    if (sortColumn === columnField) {
      if (sortColumn !== columnField) {
        setSortColumn(columnField);
      }
      setSortColumnDirection((prevDirection) => {
        if (!prevDirection) return 'asc';
        return prevDirection === 'asc' ? 'desc' : undefined;
      });
      if (onSortChange) {
        let sortDir: 'asc' | 'desc' | undefined;
        if (!sortColumnDirection) {
          sortDir = 'asc';
        } else {
          sortDir = sortColumnDirection === 'asc' ? 'desc' : undefined;
        }
        onSortChange(columnField, sortDir);
      }
    } else {
      setSortColumn(columnField);
      setSortColumnDirection('asc');
      if (onSortChange) {
        onSortChange(columnField, 'asc');
      }
    }
  };
  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };
  const handleChangeRowsPerPage = (newPageSize: number) => {
    setRowsPerPage(newPageSize);
    setPage(0);
  };
  return (
    <Paper className={classList} {...rest}>
      <TableToolbar title={title} actions={toolbarActions} />
      {isLoading && <TableOverlayLoading />}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.field}>
                  {column.sort === false ? (
                    column.title
                  ) : (
                    <TableSortLabel
                      active={sortColumn === column.field && !!sortColumnDirection}
                      direction={(sortColumn === column.field && sortColumnDirection) || undefined}
                      onClick={() => handleSortChange(column.field)}
                    >
                      {column.title}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {tableData.map((row, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column.field}>{column.render ? column.render(row) : row[column.field]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!tableData?.length && <div className='empty-data'>{emptyDataLabel}</div>}
      </TableContainer>
      {showPagination && (
        <TablePagination
          page={useBackendPagination ? page : internalPage}
          rowsPerPage={useBackendPagination ? pageSize : rowsPerPage}
          count={totalCount || data.length}
          totalPages={totalPages}
          rowsPerPageOptions={pageSizeOptions}
          labelRowsPerPage={pageSizeLabel}
          onPageChange={onChangePage || handleChangePage}
          onRowsPerPageChange={onChangeRowsPerPage || handleChangeRowsPerPage}
          totalCountLabel={totalCountLabel}
          showFirstLastButtons={showFirstLastButtons}
          arrowVariant={arrowVariant}
          showRange={showRange}
        />
      )}
    </Paper>
  );
};

TableMaterial.defaultProps = defaultProps as Partial<TableMaterialOptionalProps>;

export default React.memo(TableMaterial);
