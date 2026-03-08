import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import Spinner from '../Spinner/Spinner';

import '../../styles/loaderPage.scss';

interface LoaderPageRequiredProps {}

interface LoaderPageOptionalProps extends DefaultProps {
  text?: string;
}

export interface LoaderPageProps extends LoaderPageRequiredProps, LoaderPageOptionalProps {}

const defaultProps: LoaderPageOptionalProps = {
  'data-testid': 'tecma-loaderPage',
  text: 'Loading...',
};

export const LoaderPage: React.FC<LoaderPageProps> = ({ className, text, ...rest }) => {
  const classList = classNames('tecma-loaderPage', className);

  return (
    <div className={classList} {...rest}>
      <div className='loaderPage-container'>
        <Spinner type='dotted-circle' size='large' />
        {text && <p className='loaderPage-text'>{text}</p>}
      </div>
    </div>
  );
};

LoaderPage.defaultProps = defaultProps as Partial<LoaderPageOptionalProps>;


