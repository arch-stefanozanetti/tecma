// import React from "react";
import Slider from '../components/Slider/Slider';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-slider',
};

describe('Slider Component', () => {
  performStandardTest(Slider, defaultProps, 'tecma-slider');
});
