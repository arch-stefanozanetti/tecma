import CheckboxGroup from '../components/CheckboxGroup/CheckboxGroup';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-checkboxGroup',
};

describe('CheckboxGroup Component', () => {
  performStandardTest(CheckboxGroup, defaultProps, 'tecma-checkboxGroup');
});
