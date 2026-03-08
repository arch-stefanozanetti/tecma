import React from 'react';

import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';

import Tooltip from '../components/Tooltip/Tooltip';

const defaultProps = {
  'data-testid': 'tecma-tooltip',
};

describe('Tooltip Component', () => {
  it('Should show if trigger element is clicked', async () => {
    await act(async () => {
      render(
        <Tooltip {...defaultProps} title='tooltip' disableFocusListener disableHoverListener disableTouchListener>
          <span id='clickTrigger'>Click</span>
        </Tooltip>,
      );
    });
    const handleClick = userEvent.setup();
    const trigger = document.querySelector('#clickTrigger');
    await act(() => handleClick.click(trigger as HTMLElement));
    const tooltipFloatingContent = document.querySelector('#tecma-floatingContent');
    expect(tooltipFloatingContent).toBeInTheDocument();
  });

  it('Should show if trigger element is hover', async () => {
    await act(async () => {
      render(
        <Tooltip {...defaultProps} title='tooltip' disableFocusListener>
          <span id='hoverTrigger'>Hover</span>
        </Tooltip>,
      );
    });
    const handleHover = userEvent.setup();
    const trigger = document.querySelector('#hoverTrigger');
    await act(() => handleHover.hover(trigger as HTMLElement));
    const tooltipFloatingContent = document.querySelector('#tecma-floatingContent');
    expect(tooltipFloatingContent).toBeInTheDocument();
  });
});
