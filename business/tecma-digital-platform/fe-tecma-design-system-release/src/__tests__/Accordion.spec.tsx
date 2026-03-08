import React from 'react';

import { render, screen } from '@testing-library/react';

import { Accordion } from '../components/Accordion';
import AccordionContent from '../components/Accordion/AccordionContent';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-accordion',
};

describe('Accordion Component', () => {
  performStandardTest(Accordion, defaultProps, 'tecma-accordion');

  describe('AccordionContent component', () => {
    performStandardTest(AccordionContent, defaultProps, 'tecma-accordion-content');
    performTest({
      description: 'Should render an accordion with 1 open panel',
      renderer: () =>
        render(
          <Accordion openPanels={0}>
            <Accordion.Content title='prova'>descrizione</Accordion.Content>
          </Accordion>,
        ),
      test: () => {
        expect(screen.getByTestId('tecma-accordion-content-panel').classList.contains('open')).toBeTruthy();
      },
      dataTestId: defaultProps['data-testid'],
    });
    performTest({
      description: 'Should render a disable component',
      renderer: () =>
        render(
          <Accordion onClick={() => {}}>
            <Accordion.Content disabled title='Disable'>
              This panel is disabled
            </Accordion.Content>
          </Accordion>,
        ),
      test: () => {
        expect(screen.getAllByRole('button')[0].classList.contains('disabled')).toBeTruthy();
      },
      dataTestId: defaultProps['data-testid'],
    });
    performTest({
      description: 'Should have multiple panel open',
      renderer: () =>
        render(
          <Accordion openPanels={[0, 1]} onClick={() => {}}>
            <Accordion.Content title='Multi1'>Panel1</Accordion.Content>
            <Accordion.Content title='Multi2'>Panel2</Accordion.Content>
          </Accordion>,
        ),
      test: () => {
        screen.getAllByTestId('tecma-accordion-content-panel').forEach((panel) => {
          expect(panel.classList.contains('open')).toBeTruthy();
        });
      },
      dataTestId: defaultProps['data-testid'],
    });
  });
});
