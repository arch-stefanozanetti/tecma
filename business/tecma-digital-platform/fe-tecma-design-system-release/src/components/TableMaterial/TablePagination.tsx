import * as React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { Pagination } from '../Pagination';
import { Select } from '../Select';

import type { OptionSelect } from '../Select/Select';

// styles
import '../../styles/tableMaterial.scss';

// Required Props
interface TablePaginationRequiredProps {
  page: number;
  rowsPerPage: number;
  count: number;
  onPageChange: (
    // event: React.MouseEvent<HTMLButtonElement, MouseEvent> | undefined,
    page: number,
  ) => void;
}

// Optional Props
interface TablePaginationOptionalProps extends DefaultProps {
  rowsPerPageOptions?: number[];

  onRowsPerPageChange?: (pageSize: number) => void;
  labelRowsPerPage?: string;
  disableMenuPortalTarget?: boolean;
  dropDownWidth?: number;
  totalPages?: number;
  totalCountLabel?: React.ReactNode;
  showFirstLastButtons?: boolean;
  arrowVariant?: 'default' | 'flat';
  showRange?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface TablePaginationProps extends TablePaginationRequiredProps, TablePaginationOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: TablePaginationOptionalProps = {
  'data-testid': 'tecma-table-pagination',
};

const TablePagination: React.FC<TablePaginationProps> = ({
  className,
  page,
  rowsPerPage,
  rowsPerPageOptions = [5, 10, 20],
  count,
  onPageChange,
  onRowsPerPageChange,
  labelRowsPerPage,
  disableMenuPortalTarget,
  dropDownWidth,
  totalPages,
  totalCountLabel,
  showFirstLastButtons,
  arrowVariant = 'default',
  showRange = false,
  ...rest
}: TablePaginationProps) => {
  const classList = classNames('tecma-table-pagination', className);
  const options: OptionSelect[] = rowsPerPageOptions.map((option) => ({
    value: `${option}`,
    label: `${option} ${labelRowsPerPage}`,
  }));
  const [selectedPageSize, setSelectedPageSize] = React.useState<OptionSelect>(
    options.find((option) => option.value.includes(`${rowsPerPage}`)) || options[0],
  );

  const getPages = () => {
    if (totalPages) return totalPages;
    return Math.ceil(count / rowsPerPage);
  };
  const pages = getPages();

  const handleCurrentPage = (newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage - 1);
    }
  };
  const handleNextPage = () => {
    if (onPageChange) {
      onPageChange(page + 1);
    }
  };
  const handlePrevPage = () => {
    if (onPageChange) {
      onPageChange(page > 0 ? page - 1 : 1);
    }
  };
  const handleFirstPage = () => {
    if (onPageChange) {
      onPageChange(0);
    }
  };
  const handleLastPage = () => {
    if (onPageChange) {
      onPageChange(pages - 1);
    }
  };
  const handlePageSizeChange = (newPageSize: OptionSelect | OptionSelect[]) => {
    if (onRowsPerPageChange && !Array.isArray(newPageSize)) {
      onRowsPerPageChange(Number(newPageSize.value));
      setSelectedPageSize(newPageSize);
    }
  };

  React.useEffect(() => {
    // Update selected option label for i18n
    const selectedOption = options.findIndex((option) => option.value === selectedPageSize.value);
    setSelectedPageSize(options[selectedOption]);
  }, [labelRowsPerPage]);

  return (
    <div className={classList} {...rest}>
      {totalCountLabel && <div>{totalCountLabel}</div>}
      <Pagination
        currentPage={page + 1}
        setCurrentPage={handleCurrentPage}
        setNextPage={handleNextPage}
        setPrevPage={handlePrevPage}
        setFirstPage={handleFirstPage}
        setLastPage={handleLastPage}
        firstButtonIcon='chevron-double-left'
        lastButtonIcon='chevron-double-right'
        showFirstLastButtons={showFirstLastButtons}
        pages={pages}
        pagesToShowCloseTheCurrent={pages <= 2 ? 0 : 1}
        nextButtonIcon='chevron-right'
        prevButtonIcon='chevron-left'
        showRange={showRange}
        rowsPerPage={rowsPerPage}
        totalCount={count}
        arrowVariant={arrowVariant}
      />
      <Select
        options={options}
        value={selectedPageSize}
        onChange={handlePageSizeChange}
        menuPortalTarget={!disableMenuPortalTarget ? document.body : undefined}
        menuPlacement='top'
        closeMenuOnSelect
        dropDownWidth={dropDownWidth}
      />
    </div>
  );
};

TablePagination.defaultProps = defaultProps as Partial<TablePaginationOptionalProps>;

export default React.memo(TablePagination);
