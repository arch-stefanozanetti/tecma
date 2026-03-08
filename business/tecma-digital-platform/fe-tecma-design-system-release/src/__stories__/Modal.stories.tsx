/* eslint-disable storybook/prefer-pascal-case */
import React, { useState } from 'react';

import { Story, ComponentMeta, ComponentStory } from '@storybook/react';

import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { ModalProps } from '../components/Modal/Modal';
import ModalContent from '../components/Modal/ModalContent';
import { Spinner } from '../components/Spinner';

export default {
  title: 'Components/Modal',
  component: Modal,
  parameters: {
    componentSubtitle:
      'Modal can be used to create a new floating layer over the current page to get user feedback or display information.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=281-6347',
    },
  },
  argTypes: {
    title: {
      type: 'text',
      description: 'Boolean value to indicate if the Modal must be open or not',
    },
    subtitle: {
      type: 'text',
      description: 'Boolean value to indicate if the Modal must be open or not',
    },
    isOpen: {
      description: 'Boolean value to indicate if the Modal must be open or not',
    },
    onClose: {
      description: 'A function to execute onClose Modal, valid for backdrop and close icon',
    },
    closeOnBackDropClick: {
      description: 'If the prop is provided the Modal con be close clicking in any point outside ',
    },
    verticalPosition: {
      description: 'If the prop is provided set Modal position to the center-top of the page',
      option: ['top', 'center', 'bottom'],
      defaultValue: 'center',
    },
    size: {
      description: 'If the prop is provided set Modal width to small',
      option: ['small', 'medium', 'large'],
      defaultValue: 'medium',
    },
    disabledMobileAnimation: {
      description: 'Disable mobile/tablet slideIn/Out animation',
      defaultValue: false,
    },
    width: {
      description: 'If the prop is provided se the width of the Modal dialog, in rem.',
    },
    closeIcon: {
      description: 'If the prop is provided to the Modal Header subcomponent, it display a clickable cross icon on top right',
    },
    style: {
      description: 'Accepts as input an object and allows to add personalized style.',
      defaultValue: {},
    },
    id: {
      defaultValue: '',
    },
    'data-testid': {
      control: 'text',
      defaultValue: 'tecma-Modal',
    },
  },
} as ComponentMeta<typeof Modal>;

const Template: Story<ModalProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>

      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <Modal.Header onClose={() => setIsOpen(false)}>
          <h2>Title</h2>
        </Modal.Header>
        <Modal.Content>
          <h3>Text title h3</h3>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo,
            nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum.
          </p>
        </Modal.Content>
        <Modal.Footer>
          <Button onClick={() => setIsOpen(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

const TemplateIcon: Story<ModalProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>

      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <Modal.Header onClose={() => setIsOpen(false)} closeIcon>
          <h2>Title</h2>
        </Modal.Header>
        <Modal.Content>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo,
            nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum.
          </p>
        </Modal.Content>
        <Modal.Footer>
          <Button onClick={() => setIsOpen(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

const TemplateDualButton: Story<ModalProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>

      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <Modal.Header closeIcon onClose={() => setIsOpen(false)}>
          <h2>Title</h2>
        </Modal.Header>
        <Modal.Content>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo,
            nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing
            elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque
            saepe cum nostrum.
          </p>
        </Modal.Content>
        <Modal.Footer noWrapAndCenter>
          <Button fluid outlined onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button fluid onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

const TemplateMultiButton: Story<ModalProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>

      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <Modal.Header closeIcon onClose={() => setIsOpen(false)}>
          <h2>Title</h2>
        </Modal.Header>
        <Modal.Footer>
          <Button outlined onClick={() => setIsOpen(false)}>
            Close
          </Button>

          <Button onClick={() => setIsOpen(false)}>Close</Button>
          <Button disabled onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button disabled onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button disabled onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button disabled onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

const TemplateLongText: Story<ModalProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>

      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <Modal.Header onClose={() => setIsOpen(false)} closeIcon>
          <h2>Title</h2>
        </Modal.Header>
        <Modal.Content>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo,
            nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing
            elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque
            saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo
            ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet
            consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim
            beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium
            odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum
            dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam
            qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non
            blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum
            nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos,
            nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur
            adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae.
            Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio
            esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor
            sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui
            cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis
            accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum.
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo,
            nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing
            elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque
            saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo
            ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet
            consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim
            beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium
            odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum
            dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam
            qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non
            blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum
            nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos,
            nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur
            adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae.
            Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio
            esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor
            sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui
            cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis
            accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum.
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo,
            nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing
            elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque
            saepe cum nostrum. Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo
            ducimus eos, nemo, nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum. Lorem ipsum dolor sit amet
            consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo, nihil, totam qui cumque enim
            beatae. Aspernatur atque saepe cum nostrum.
          </p>
        </Modal.Content>
        <Modal.Footer noWrapAndCenter>
          <Button fluid outlined onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button fluid onClick={() => setIsOpen(false)}>
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

const TemplateDelay: Story<ModalProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  const onClickClose = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>

      <Modal {...args} isOpen={isOpen} onClose={onClickClose}>
        <Modal.Header onClose={onClickClose}>
          <h2>Title</h2>
        </Modal.Header>
        <ModalContent>
          <p>The modal will be closed after two seconds</p>
        </ModalContent>
        <Modal.Footer>
          <Button fluid onClick={onClickClose}>
            {isLoading ? <Spinner size='small' /> : 'Close'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

const TemplateCustomHeader: Story<ModalProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>

      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} closeOnBackDropClick>
        <Modal.Header
          onClose={() => setIsOpen(false)}
          title='TECMA'
          subtitle='Prova ticket'
          backgroundImage='https://i.pinimg.com/originals/88/4d/e8/884de81d29f37619ff17935475764213.jpg'
          isBackgroundDark
          closeIcon
        />
        <Modal.Content>
          <h3>Text title h3</h3>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo,
            nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum.
          </p>
        </Modal.Content>
        <Modal.Footer>
          <Button onClick={() => setIsOpen(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
const TemplateCloseOnBackDropClick: Story<ModalProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>

      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} closeOnBackDropClick>
        <Modal.Header onClose={() => setIsOpen(false)}>
          <h2>Title</h2>
        </Modal.Header>
        <Modal.Content>
          <h3>Text title h3</h3>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Non blanditiis accusantium odio esse quae ea quo ducimus eos, nemo,
            nihil, totam qui cumque enim beatae. Aspernatur atque saepe cum nostrum.
          </p>
        </Modal.Content>
        <Modal.Footer>
          <Button onClick={() => setIsOpen(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export const Basic: ComponentStory<typeof Modal> = (args) => <Template {...args} />;

export const BasicDelay: ComponentStory<typeof Modal> = (args) => <TemplateDelay {...args} />;

export const CloseIcon: ComponentStory<typeof Modal> = (args) => <TemplateIcon {...args} />;
export const DualButton: ComponentStory<typeof Modal> = (args) => <TemplateDualButton {...args} />;
export const MultiButton: ComponentStory<typeof Modal> = (args) => <TemplateMultiButton {...args} />;
export const LongText: ComponentStory<typeof Modal> = (args) => <TemplateLongText {...args} />;
export const closeOnBackDropClick: ComponentStory<typeof Modal> = (args) => <TemplateCloseOnBackDropClick {...args} />;
export const customHeader: ComponentStory<typeof Modal> = (args) => <TemplateCustomHeader {...args} />;

Basic.storyName = 'Basic Usage';
BasicDelay.storyName = 'Async close';

CloseIcon.storyName = 'With close icon';
DualButton.storyName = 'Dual button Modal';
MultiButton.storyName = 'Multi buttons Modal';
LongText.storyName = 'With very long text';
