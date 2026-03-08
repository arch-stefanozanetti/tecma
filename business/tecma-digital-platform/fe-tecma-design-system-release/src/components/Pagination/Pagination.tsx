import React, { MouseEventHandler } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { Button } from '../Button';
import { createPaginationArray } from '../../helpers/pagination';

import type { ButtonProps } from '../Button/Button';
import type { IconName } from '../Icon/IconName';

// styles
import '../../styles/pagination.scss';

// Required Props
interface PaginationRequiredProps {
  // The number of pages to show
  pages: number;
  // The current page
  currentPage: number;
  // Defines the callback to perform on page click
  setCurrentPage: (page: number) => void;
  // Defines the callback to perform on next page click
  setNextPage: MouseEventHandler<HTMLButtonElement>;
  // Defines the callback to perform on prev page click
  setPrevPage: MouseEventHandler<HTMLButtonElement>;
}

// Optional Props
interface PaginationOptionalProps extends DefaultProps {
  // Defines if the pagination is disabled
  disabled?: boolean;
  // Defines how many pages to show close to the current page //TODO: find better name for this prop :)
  pagesToShowCloseTheCurrent?: number;
  nextButtonIcon?: IconName;
  prevButtonIcon?: IconName;
  firstButtonIcon?: IconName;
  lastButtonIcon?: IconName;
  outlined?: boolean;
  currentPageButtonStyle?: ButtonProps;
  setFirstPage?: MouseEventHandler<HTMLButtonElement>;
  setLastPage?: MouseEventHandler<HTMLButtonElement>;
  showFirstLastButtons?: boolean;
  // Show range instead of page numbers (e.g., "1-10 of 200")
  showRange?: boolean;
  rowsPerPage?: number;
  totalCount?: number;
  // Arrow button variant style
  arrowVariant?: 'default' | 'flat';
}

// Combined required and optional props to build the full prop interface
export interface PaginationProps extends PaginationRequiredProps, PaginationOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: PaginationOptionalProps = {
  'data-testid': 'tecma-pagination',
  disabled: false,
  pagesToShowCloseTheCurrent: 1,
  showFirstLastButtons: false,
  showRange: false,
  arrowVariant: 'default',
};

const Pagination: React.FC<PaginationProps> = ({
  pages,
  currentPage,
  setCurrentPage,
  setNextPage,
  setPrevPage,
  setFirstPage,
  setLastPage,
  disabled,
  pagesToShowCloseTheCurrent,
  className,
  nextButtonIcon,
  prevButtonIcon,
  firstButtonIcon,
  lastButtonIcon,
  outlined,
  currentPageButtonStyle,
  showFirstLastButtons,
  showRange,
  rowsPerPage,
  totalCount,
  arrowVariant,
  ...rest
}) => {
  const classList = classNames('tecma-pagination', disabled, className);
  // TODO: the pagination array could be handle better
  const paginationArray = createPaginationArray(pages, currentPage, pagesToShowCloseTheCurrent);

  const arrowButtonClass = classNames('pagination-arrow', {
    'pagination-arrow--flat': arrowVariant === 'flat',
  });

  // Calculate range for display
  const getRangeDisplay = () => {
    if (!showRange || !rowsPerPage || !totalCount) return null;
    
    const startItem = (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalCount);
    
    return (
      <div className='pagination-range-container'>
        <span style={{ fontWeight: 'bold' }}>{startItem}-{endItem}</span>
        {'of'}
        <span style={{ fontWeight: 'bold' }}>{totalCount}</span>
      </div>
    );
  };

  return (
    <div className={classList} {...rest}>
      {showFirstLastButtons && (
        <Button
          iconName={firstButtonIcon || 'chevron-double-left'}
          onClick={setFirstPage || (() => setCurrentPage(1))}
          disabled={currentPage === 1 || disabled}
          color='transparent'
          className={arrowButtonClass}
        />
      )}
      <Button
        iconName={prevButtonIcon || 'arrow-left'}
        onClick={setPrevPage}
        disabled={currentPage === 1 || disabled}
        color='transparent'
        className={arrowButtonClass}
      />
      {showRange ? (
        <div className="pagination-range">{getRangeDisplay()}</div>
      ) : (
        paginationArray.map((page: number | string) => (
          <Button
            onClick={() => setCurrentPage(page as number)}
            className={classNames('pagination-page', {
              'is-selected': currentPage === (page as number),
              'is-not-page': page === '...',
            })}
            disabled={disabled}
            color='transparent'
            outlined={currentPage === (page as number) && outlined}
            {...currentPageButtonStyle}
          >
            {page as number}
          </Button>
        ))
      )}
      <Button
        iconName={nextButtonIcon || 'arrow-right'}
        onClick={setNextPage}
        disabled={currentPage === pages || disabled}
        color='transparent'
        className={arrowButtonClass}
      />
      {showFirstLastButtons && (
        <Button
          iconName={lastButtonIcon || 'chevron-double-right'}
          onClick={setLastPage || (() => setCurrentPage(pages))}
          disabled={currentPage === pages || disabled}
          color='transparent'
          className={arrowButtonClass}
        />
      )}
    </div>
  );
};

Pagination.defaultProps = defaultProps as Partial<PaginationOptionalProps>;

export default React.memo(Pagination);
