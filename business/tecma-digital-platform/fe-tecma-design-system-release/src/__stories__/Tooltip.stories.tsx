import React, { forwardRef, useState } from 'react';

import { Fade, Zoom } from '@mui/material';
import { Story, Meta } from '@storybook/react';

import Button, { ButtonProps } from '../components/Button/Button';
import { Tooltip } from '../components/Tooltip';
import { TooltipProps } from '../components/Tooltip/Tooltip';

export default {
  title: 'Components/Tooltip',
  component: Tooltip,
  parameters: {
    componentSubtitle:
      'A means of displaying a description or extra information about an element, usually on hover, but can also be on click or tap.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=49-311',
    },
  },
  argTypes: {
    id: {
      control: 'text',
      defaultValue: '',
    },
    style: {
      defaultValue: {},
    },
    placement: {
      description: 'Tooltip placement.',
      defaultValue: 'bottom',
      control: { type: 'select' },
      options: [
        'bottom-end',
        'bottom-start',
        'bottom',
        'left-end',
        'left-start',
        'left',
        'right-end',
        'right-start',
        'right',
        'top-end',
        'top-start',
        'top',
      ],
    },
    arrow: {
      defaultValue: false,
      control: 'boolean',
      description: 'If true, adds an arrow to the tooltip.',
    },
    title: {
      defaultValue: 'I am a tooltip',
      control: 'text',
      description: 'Tooltip title. Zero-length titles string, undefined, null and false are never displayed.',
    },
    classes: {
      description: 'Override or extend the styles applied to the component.',
      control: 'text',
      defaultValue: '',
    },
    components: {
      description:
        "The components used for each slot inside.This prop is an alias for the slots prop. It's recommended to use the slots prop instead.",
      defaultValue: {},
    },
    componentsProps: {
      description:
        "The extra props for the slot components. You can override the existing props or add new ones.This prop is an alias for the slotProps prop. It's recommended to use the slotProps prop instead, as componentsProps will be deprecated in the future.",
      defaultValue: {},
    },
    describeChild: {
      description:
        'Set to true if the title acts as an accessible description. By default the title acts as an accessible label for the child.',
      control: 'boolean',
      defaultValue: 'false',
    },
    disableFocusListener: {
      description: 'Do not respond to focus-visible events.',
    },
    disableHoverListener: {
      description: 'Do not respond to hover events.',
    },
    disableInteractive: {
      description:
        'Makes a tooltip not interactive, i.e. it will close when the user hovers over the tooltip before the leaveDelay is expired.',
      control: 'boolean',
      defaultValue: 'false',
    },
    disableTouchListener: {
      description: 'Do not respond to long press touch events.',
    },
    enterDelay: {
      description:
        "The number of milliseconds to wait before showing the tooltip. This prop won't impact the enter touch delay (enterTouchDelay).",
      control: 'number',
      defaultValue: 0,
    },
    enterNextDelay: {
      description: 'The number of milliseconds to wait before showing the tooltip when one was already recently opened.',
      control: 'number',
      defaultValue: 0,
    },
    enterTouchDelay: {
      description: 'The number of milliseconds a user must touch the element before showing the tooltip.',
      control: 'number',
      defaultValue: 0,
    },
    followCursor: {
      description: 'If true, the tooltip follow the cursor over the wrapped element.',
    },
    leaveDelay: {
      description:
        "The number of milliseconds to wait before hiding the tooltip. This prop won't impact the leave touch delay (leaveTouchDelay).",
      control: 'number',
      defaultValue: 0,
    },
    leaveTouchDelay: {
      description: 'The number of milliseconds after the user stops touching an element before hiding the tooltip.',
      control: 'number',
      defaultValue: 0,
    },
    onClose: {
      description: 'Callback fired when the component requests to be closed.',
      defaultValue: () => console.log('CLICKED'),
      action: 'clicked',
    },
    onOpen: {
      description: 'Callback fired when the component requests to be open.',
      defaultValue: () => console.log('CLICKED'),
      action: 'clicked',
    },
    open: {
      description: 'If true, the component is shown.',
    },
    PopperComponent: { description: 'The component used for the popper.' },
    PopperProps: { description: 'Props applied to the Popper element.', defaultValue: {} },
    TransitionComponent: {
      description: 'The component used for the transition. Follow this guide to learn more about the requirements for this component.',
    },
    TransitionProps: {
      description: 'Props applied to the transition element. By default, the element is based on this Transition component.',
      defaultValue: {},
    },
    slotProps: {
      description:
        'The extra props for the slot components. You can override the existing props or add new ones.This prop is an alias for the componentsProps prop, which will be deprecated in the future.',
    },
    slots: {
      description:
        'The components used for each slot inside.This prop is an alias for the components prop, which will be deprecated in the future.',
    },
    sx: {
      description: 'The system prop that allows defining system overrides as well as additional CSS styles.',
    },
    className: {
      control: 'text',
      defaultValue: '',
    },
  },
} as Meta<typeof Tooltip>;

export const BasicUsage: Story<TooltipProps> = (args) => {
  const { title, placement, arrow } = args;
  return (
    <Tooltip disableFocusListener followCursor={false} title={title} placement={placement} arrow={arrow}>
      <p>Hover me!</p>
    </Tooltip>
  );
};

export const Arrow = () => (
  <Tooltip title='Add' arrow>
    <p>Arrow</p>
  </Tooltip>
);
Arrow.parameters = {
  docs: {
    description: {
      story: 'You can use the `arrow` prop to give your tooltip an arrow indicating which element it refers to.        ',
    },
  },
};

const ButtonComponent = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  return (
    <Button {...props} ref={ref} type='button'>
      click
    </Button>
  );
});

export const Triggers: Story<TooltipProps> = (args) => {
  const [open, setOpen] = useState(false);

  const handleTooltip = () => {
    setOpen(!open);
  };

  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <Tooltip disableFocusListener title='Add'>
        <p>Hover or touch</p>
      </Tooltip>
      <Tooltip disableHoverListener title='Add'>
        <p>Focus or touch</p>
      </Tooltip>
      <Tooltip disableFocusListener disableTouchListener title='Add'>
        <p>Hover</p>
      </Tooltip>
      <Tooltip {...args} disableFocusListener disableHoverListener disableTouchListener onClose={handleTooltip} open={open}>
        <ButtonComponent onClick={handleTooltip} type='button' />
      </Tooltip>
    </div>
  );
};
Triggers.parameters = {
  docs: {
    description: {
      story:
        'You can define the types of events that cause a tooltip to show.The touch action requires a long press due to the `enterTouchDelay` prop being set to 700ms by default.',
    },
  },
};
export const Placement = () => {
  const topBottomStyle = {
    display: 'flex',
    gap: '3rem',
    justifyContent: 'space-between',
    paddingLeft: '2rem',
    paddingRight: '2rem',
  };
  const paragraphStyle = {
    border: '0.0625rem',
    borderColor: 'blue',
    borderStyle: 'solid',
    padding: '0.25rem',
  };
  return (
    <div>
      <div style={topBottomStyle}>
        <Tooltip title='Add' placement='top-start' arrow>
          <p style={paragraphStyle}>top-start</p>
        </Tooltip>
        <Tooltip title='Add' placement='top' arrow>
          <p style={paragraphStyle}>top</p>
        </Tooltip>
        <Tooltip title='Add' placement='top-end' arrow>
          <p style={paragraphStyle}>top-end</p>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Tooltip title='Add' placement='left-start' arrow>
            <p style={paragraphStyle}>left-start</p>
          </Tooltip>
          <Tooltip title='Add' placement='left' arrow>
            <p style={paragraphStyle}>left</p>
          </Tooltip>
          <Tooltip title='Add' placement='left-end' arrow>
            <p style={paragraphStyle}>left-end</p>
          </Tooltip>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Tooltip title='Add' placement='right-start' arrow>
            <p style={paragraphStyle}>right-start</p>
          </Tooltip>
          <Tooltip title='Add' placement='right' arrow>
            <p style={paragraphStyle}>right</p>
          </Tooltip>
          <Tooltip title='Add' placement='right-end' arrow>
            <p style={paragraphStyle}>right-end</p>
          </Tooltip>
        </div>
      </div>
      <div style={topBottomStyle}>
        <Tooltip title='Add' placement='bottom-start' arrow>
          <p style={paragraphStyle}>bottom-start</p>
        </Tooltip>
        <Tooltip title='Add' placement='bottom' arrow>
          <p style={paragraphStyle}>bottom</p>
        </Tooltip>
        <Tooltip title='Add' placement='bottom-end' arrow>
          <p style={paragraphStyle}>bottom-end</p>
        </Tooltip>
      </div>
    </div>
  );
};
Placement.parameters = {
  docs: {
    description: {
      story:
        "The Tooltip has 12 placement choices. They don't have directional arrows; instead, they rely on motion emanating from the source to convey direction.",
    },
  },
};

export const Offset: Story<TooltipProps> = () => (
  <Tooltip
    title='Add'
    slotProps={{
      popper: {
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [0, -14],
            },
          },
        ],
      },
    }}
  >
    <p>Offset</p>
  </Tooltip>
);
Offset.parameters = {
  docs: {
    description: {
      story:
        'To adjust the distance between the tooltip and its anchor, you can use the `slotProps` prop to modify the offset of the popper.',
    },
  },
};

export const Controlled: Story<TooltipProps> = () => {
  const [open, setOpen] = React.useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const handleOpen = () => {
    setOpen(true);
  };

  return (
    <Tooltip open={open} onClose={handleClose} onOpen={handleOpen} title='Add'>
      <p>Controlled</p>
    </Tooltip>
  );
};
Controlled.parameters = {
  docs: {
    description: {
      story: 'You can use the `open`, `onOpen` and `onClose` props to control the behavior of the tooltip.',
    },
  },
};

export const Interactive: Story<TooltipProps> = () => (
  <Tooltip disableInteractive title='Add'>
    <p>Interactive</p>
  </Tooltip>
);

Interactive.parameters = {
  docs: {
    description: {
      story:
        "Tooltips are interactive by default (to pass WCAG 2.1 success criterion 1.4.13). It won't close when the user hovers over the tooltip before the `leaveDelay `is expired. You can disable this behavior (thus failing the success criterion which is required to reach level AA) by passing `disableInteractive`.",
    },
  },
};

export const Transition: Story<TooltipProps> = () => (
  <div style={{ display: 'flex', gap: '1rem' }}>
    <Tooltip title='Add'>
      <p>Grow</p>
    </Tooltip>
    <Tooltip TransitionComponent={Fade} TransitionProps={{ timeout: 600 }} title='Add'>
      <p>Fade</p>
    </Tooltip>
    <Tooltip TransitionComponent={Zoom} title='Add'>
      <p>Zoom</p>
    </Tooltip>
  </div>
);

Transition.parameters = {
  docs: {
    description: {
      story: 'Use a different transition.',
    },
  },
};

export const Delay: Story<TooltipProps> = () => (
  <Tooltip title='Add' enterDelay={500} leaveDelay={200}>
    <p>Delay</p>
  </Tooltip>
);

Delay.parameters = {
  docs: {
    description: {
      story:
        "The tooltip is normally shown immediately when the user's mouse hovers over the element, and hides immediately when the user's mouse leaves. A delay in showing or hiding the tooltip can be added through the `enterDelay` and `leaveDelay` props.On mobile, the tooltip is displayed when the user longpresses the element and hides after a delay of 1500ms. You can disable this feature with the `disableTouchListener` prop.",
    },
  },
};
