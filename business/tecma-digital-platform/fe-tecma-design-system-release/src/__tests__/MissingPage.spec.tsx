import performStandardTest from 'helpers/performStandardTest';

import { MissingPage } from '../components/MissingPage';

const defaultProps = {
  'data-testid': 'tecma-missingPage',
};

describe('MissingPage Component', () => {
  performStandardTest(MissingPage, defaultProps, 'tecma-missingPage');
});
