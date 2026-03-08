import { getAllCSSVariables } from '../components/ThemeLoaders';

describe('ThemeLoaders', () => {
  it('getAllCSSVariables should add variants correctly', () => {
    const variables = getAllCSSVariables({ test: '#123456', 'test-no-variant': '#123456' }, ['test']);
    expect(variables).toEqual([
      ['test', '#123456'],
      ['test-light', '#1f5993'],
      ['test-dark', '#040d15'],
      ['test-no-variant', '#123456'],
    ]);
  });
});
