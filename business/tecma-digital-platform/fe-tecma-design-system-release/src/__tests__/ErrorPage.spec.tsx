import { ErrorPage } from 'components/ErrorPage';

import performStandardTest from 'helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-errorPage',
};

describe('ErrorPage Component', () => {
  performStandardTest(ErrorPage, defaultProps, 'tecma-errorPage');
});
