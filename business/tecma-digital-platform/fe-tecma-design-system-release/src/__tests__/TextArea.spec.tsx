// import React from "react";
import TextArea from '../components/TextArea/TextArea';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-textArea',
};

describe('TextArea Component', () => {
  performStandardTest(TextArea, defaultProps, 'tecma-textArea');
});
