import React, { MouseEventHandler, ReactNode } from 'react';

import classNames from 'classnames';

import { constants } from '../../constants/error-page';
import { DefaultProps } from '../../declarations';
import { Button } from '../Button';
import { Divider } from '../Divider';
import { DEFAULT_LANGUAGE } from '../LanguageSelector/constants';
import { LazyImage } from '../LazyImage';

// styles
import '../../styles/errorPage.scss';

// Required Props
interface ErrorPageRequiredProps {}

// Optional Props
interface ErrorPageOptionalProps extends DefaultProps {
  errorMsg?: string;
  errorCause?: string;
  errorSolution?: string | ReactNode;
  buttonLabel?: string;
  /**
   * The function to perform on button click. When undefined, the button refresh the page only.
   */
  buttonOnClick?: MouseEventHandler<HTMLButtonElement>;
  logo?: string;
  // The user language
  language?: string;
}

// Combined required and optional props to build the full prop interface
export interface ErrorPageProps extends ErrorPageRequiredProps, ErrorPageOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: ErrorPageOptionalProps = {
  language: DEFAULT_LANGUAGE,
  'data-testid': 'tecma-errorPage',
};

export const ErrorPage: React.FC<ErrorPageProps> = ({
  className,
  errorMsg,
  language = DEFAULT_LANGUAGE,
  errorCause,
  errorSolution,
  buttonLabel,
  buttonOnClick,
  logo,
}) => {
  const classList = classNames('tecma-errorPage', className);

  const handleButtonClick: MouseEventHandler<HTMLButtonElement> = (e) => (buttonOnClick ? buttonOnClick(e) : window.location.reload());

  return (
    <div className={classList}>
      <div className='errorPage-container'>
        <h1 className='errorPage-errorMsg'>{errorMsg || constants[language].errorMsg}</h1>
        <Divider />
        <div className='errorPage-desc'>
          <span>{errorCause || constants[language].errorCause} </span>
          {errorSolution || constants[language].errorSolution}
        </div>
        <Button onClick={handleButtonClick} color='primary'>
          {buttonLabel || constants[language].buttonLabel}
        </Button>
        {logo && <LazyImage.Image src={logo} errorElement={<> </>} loadingElement={<> </>} />}
      </div>
    </div>
  );
};

ErrorPage.defaultProps = defaultProps as Partial<ErrorPageOptionalProps>;
