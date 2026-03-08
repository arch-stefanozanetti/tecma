import { Alert } from '../components/Alert';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-alert',
};

describe('Alert Component', () => {
  performStandardTest(Alert, defaultProps, 'tecma-alert');
});
