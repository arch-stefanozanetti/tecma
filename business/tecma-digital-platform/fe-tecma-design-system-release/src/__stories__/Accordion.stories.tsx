import React, { MouseEventHandler, useState } from 'react';

import { Story, Meta, ComponentStory } from '@storybook/react';

import { Accordion } from '../components/Accordion';
import { AccordionProps } from '../components/Accordion/Accordion';
import AccordionContent from '../components/Accordion/AccordionContent';
import { Avatar } from '../components/Avatar';
import { LOREM_IPSUM } from '../mock/text';

// 👇 We create a “template” of how args map to rendering
const Template: Story<AccordionProps> = () => {
  const [openAccordions, setOpenAccordion] = useState<number>(-1);

  const handleClick = (_e: MouseEventHandler<HTMLButtonElement>, index: number) => {
    setOpenAccordion(index === openAccordions ? -1 : index);
  };

  return (
    <Accordion openPanels={openAccordions} onClick={handleClick}>
      <Accordion.Content title='Accordion 1'>{LOREM_IPSUM}</Accordion.Content>
      <Accordion.Content title='Accordion 2'>{LOREM_IPSUM}</Accordion.Content>
    </Accordion>
  );
};

const MultiPanelsTemplate: Story<AccordionProps> = () => {
  const [openPanels, setOpenPanels] = useState<Array<number>>([]);

  const handleClick = (_e: MouseEventHandler<HTMLButtonElement>, index: number) => {
    const panels = openPanels.includes(index) ? openPanels.filter((internalId) => internalId !== index) : [...openPanels, index];
    setOpenPanels(panels);
  };

  return (
    <Accordion openPanels={openPanels} onClick={handleClick}>
      <Accordion.Content title='prova1'>{LOREM_IPSUM}</Accordion.Content>
      <Accordion.Content title='prova2'>{LOREM_IPSUM}</Accordion.Content>
    </Accordion>
  );
};

const DisabledTemplate: Story<AccordionProps> = () => {
  const [openAccordions, setOpenAccordion] = useState<number>(-1);

  const handleClick = (_e: MouseEventHandler<HTMLButtonElement>, index: number) => {
    setOpenAccordion(index === openAccordions ? -1 : index);
  };

  return (
    <Accordion openPanels={openAccordions} onClick={handleClick}>
      <Accordion.Content title='Accordion 1' disabled>
        {LOREM_IPSUM}
      </Accordion.Content>
      <Accordion.Content title='Accordion 2'>{LOREM_IPSUM}</Accordion.Content>
    </Accordion>
  );
};

const IconsTemplate: Story<AccordionProps> = () => {
  const [openAccordions, setOpenAccordion] = useState<number>(-1);

  const handleClick = (_e: MouseEventHandler<HTMLButtonElement>, index: number) => {
    setOpenAccordion(index === openAccordions ? -1 : index);
  };

  return (
    <Accordion openPanels={openAccordions} onClick={handleClick}>
      <Accordion.Content title='Accordion 1' iconOnClose='users' iconOnOpen='home'>
        {LOREM_IPSUM}
      </Accordion.Content>
      <Accordion.Content title='Accordion 2' iconOnClose='stairs' iconOnOpen='office-building'>
        {LOREM_IPSUM}
      </Accordion.Content>
    </Accordion>
  );
};

const HeaderTemplate: Story<AccordionProps> = () => {
  const [openAccordions, setOpenAccordion] = useState<number>(-1);

  const handleClick = (_e: MouseEventHandler<HTMLButtonElement>, index: number) => {
    setOpenAccordion(index === openAccordions ? -1 : index);
  };

  return (
    <Accordion openPanels={openAccordions} onClick={handleClick}>
      <Accordion.Content headerComponent={<Avatar size='medium' text='SH' />}>{LOREM_IPSUM}</Accordion.Content>
      <Accordion.Content title='Accordion 2' iconOnClose='stairs' iconOnOpen='office-building'>
        {LOREM_IPSUM}
      </Accordion.Content>
    </Accordion>
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const Multi: ComponentStory<typeof Accordion> = MultiPanelsTemplate.bind({});
Multi.storyName = 'Multi Panels Usage';
Multi.parameters = {
  docs: {
    description: {
      story: 'It is possible to have more than one accordion open.',
    },
  },
};
export const Disabled: ComponentStory<typeof Accordion> = DisabledTemplate.bind({});
Disabled.storyName = 'Disabled Panels Usage';
Disabled.parameters = {
  docs: {
    description: {
      story: 'If true, the accordion is disabled.',
    },
  },
};
export const Icons: ComponentStory<typeof Accordion> = IconsTemplate.bind({});
Icons.storyName = 'Icons Usage';
Icons.parameters = {
  docs: {
    description: {
      story: 'Using `iconOnClose` and `iconOnOpen` is possible to modify the accordion icons.',
    },
  },
};
export const Header: ComponentStory<typeof Accordion> = HeaderTemplate.bind({});
Header.storyName = 'Avatar Usage';
Header.parameters = {
  docs: {
    description: {
      story: 'Using `headerComponent`is possibile to render a different accordion header.',
    },
  },
};

const CustomAnimationTimingTemplate: Story<AccordionProps> = () => {
  const [openPanels, setOpenPanels] = useState<Array<number>>([]);

  const handleClick = (_e: MouseEventHandler<HTMLButtonElement>, index: number) => {
    const panels = openPanels.includes(index) ? openPanels.filter((internalId) => internalId !== index) : [...openPanels, index];
    setOpenPanels(panels);
  };

  return (
    <Accordion openPanels={openPanels} onClick={handleClick}>
      <Accordion.Content title='This will collapse in 1s' animationTimeMillis={1000}>
        {LOREM_IPSUM}
      </Accordion.Content>
      <Accordion.Content title='This will open in 2s and close in 500ms' animationTimeMillis={2000} animationExitTimeMillis={500}>
        {LOREM_IPSUM}
      </Accordion.Content>
    </Accordion>
  );
};
export const CustomAnimationTiming: ComponentStory<typeof Accordion> = (args) => <CustomAnimationTimingTemplate {...args} />;
CustomAnimationTiming.parameters = {
  docs: {
    description: {
      story: 'It is possible to handle the opening and closing timing using `animationTimeMillis` and `animationExitTimeMillis`.',
    },
  },
};

export default {
  title: 'Components/Accordion',
  component: Accordion,
  parameters: {
    componentSubtitle:
      "An accordion is a vertical stack of interactive headings used to toggle the display of further information; each item can be 'collapsed' with just a short label visible or 'expanded' to show the full content.",
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?type=design&node-id=893%3A10621&mode=design&t=o0ML30BS1YOqi7Dh-1',
    },
  },
  argTypes: {
    openPanels: {
      description: 'A number or array of numbers to indicate which accordion should be open',
      control: false,
    },
    onClick: {
      description: 'The action to perform on accordion click',
      defaultValue: undefined,
      action: 'clicked',
    },
  },
  subcomponents: { AccordionContent },
} as Meta<typeof Accordion>;
