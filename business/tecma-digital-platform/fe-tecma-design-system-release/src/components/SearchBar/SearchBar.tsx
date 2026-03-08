import React, { useEffect, useState } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { useFormHandler } from '../../hooks/useFormHandler';
import { Button } from '../Button';
import { Input } from '../Input';
import { Spinner } from '../Spinner';

// styles
import '../../styles/search-bar.scss';
import { RegisterOptions } from 'react-hook-form';

// Required Props
interface SearchBarRequiredProps {
  onSearch: (query: string) => void;
  onCancel: () => void;
}

// Optional Props
interface SearchBarOptionalProps extends DefaultProps {
  placeholder?: string;
  defaultValue?: string;
  searchButtonText?: string;
  cancelButtonText?: string;
  options?: RegisterOptions<FormFields, 'search'>;
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
}

// Combined required and optional props to build the full prop interface
export interface SearchBarProps extends SearchBarRequiredProps, SearchBarOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: SearchBarOptionalProps = {
  'data-testid': 'tecma-search-bar',
};

interface FormFields {
  search: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  className,
  placeholder,
  defaultValue = '',
  searchButtonText = 'Search',
  cancelButtonText = 'Cancel',
  options,
  isLoading = false,
  disabled,
  label,
  onSearch,
  onCancel,
  ...rest
}) => {
  const classListSearchBar = classNames('tecma-search-bar', className);
  const classListButton = classNames('search-button', { 'form-with-label': label });
  const { handleSubmit, register, errors, clearErrors, watch, reset, trigger } = useFormHandler<FormFields>({
    mode: 'onBlur',
    defaultValues: {
      search: defaultValue,
    },
  });
  const [wasSubmitted, setWasSubmitted] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const search = watch('search');
  const shouldShowCancelButton = () => {
    if (isLoading) return false;
    if (!isInputFocused && (wasSubmitted || defaultValue?.length)) {
      return true;
    }
    return false;
  };
  const showCancelButton = shouldShowCancelButton();
  const disableSubmit = disabled;
  const { onBlur, ...fieldValues } = register('search', options);

  const handleOnBlur = (e: React.FocusEvent<HTMLInputElement, Element>) => {
    e.persist();
    onBlur(e);
    if (e.relatedTarget?.id !== 'search-bar-submit-button') {
      setIsInputFocused(false);
    }
  };
  const onSubmit = (formFields?: FormFields) => {
    if (!disableSubmit) {
      onSearch(formFields?.search ?? '');
      if (formFields?.search) {
        setWasSubmitted(true);
      } else if (wasSubmitted) {
        setWasSubmitted(false);
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
    if (isInputFocused) {
      setIsInputFocused(false);
    }
  };
  const resetSearch = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onCancel();
    clearErrors('search');
    reset({ search: '' });
    setWasSubmitted(false);
  };
  const handleEnterKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isLoading && e.code === 'Enter') {
      handleSubmit(onSubmit)();
    }
  };

  useEffect(() => {
    if (search) {
      trigger('search');
    }
  }, []);

  return (
    <form className={classListSearchBar} {...rest} onSubmit={handleSubmit(onSubmit)}>
      <Input
        {...fieldValues}
        leftIconName='search'
        onFocus={() => setIsInputFocused(true)}
        onBlur={handleOnBlur}
        status={errors.search ? 'error' : undefined}
        helpText={errors.search?.message}
        placeholder={placeholder}
        disabled={disabled}
        label={label}
        onKeyDown={handleEnterKeyPress}
      />
      <Button
        type='submit'
        onClick={!showCancelButton ? handleSubmit(onSubmit) : resetSearch}
        className={classListButton}
        iconName={showCancelButton ? 'x' : undefined}
        disabled={disableSubmit}
        id='search-bar-submit-button'
      >
        {isLoading && <Spinner size='small' type='dotted-circle' />}
        {!showCancelButton ? searchButtonText : cancelButtonText}
      </Button>
    </form>
  );
};

SearchBar.defaultProps = defaultProps as Partial<SearchBarOptionalProps>;

export default React.memo(SearchBar);
