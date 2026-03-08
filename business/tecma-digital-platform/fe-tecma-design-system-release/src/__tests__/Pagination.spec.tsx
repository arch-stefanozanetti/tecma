// import React from "react";
import Pagination from '../components/Pagination/Pagination';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-pagination',
};

describe('Pagination Component', () => {
  performStandardTest(Pagination, defaultProps, 'tecma-pagination');
});
