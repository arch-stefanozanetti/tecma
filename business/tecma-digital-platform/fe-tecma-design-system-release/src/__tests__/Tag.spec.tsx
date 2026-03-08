// import React from "react";
import Tag from '../components/Tag/Tag';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-tag',
};

describe('Tag Component', () => {
  performStandardTest(Tag, defaultProps, 'tecma-tag');
});
