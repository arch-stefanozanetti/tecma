import React from 'react';

import { fireEvent, render } from '@testing-library/react';

// import userEvent from "@testing-library/user-event";
import { mockFetchArrowUp } from '../components/Icon/mock/mockFetchIcon';
import { Modal } from '../components/Modal';
import ModalContent from '../components/Modal/ModalContent';
import ModalFooter from '../components/Modal/ModalFooter';
import ModalHeader from '../components/Modal/ModalHeader';
import performStandardTest, { performTest } from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-modal',
  width: 30,
  isOpen: true,
};

const onCloseMock = jest.fn();

describe('Modal Component', () => {
  performStandardTest(Modal, defaultProps, 'tecma-modal');

  performTest({
    description: 'Modal with closeOnBackDropClick',
    renderer: () =>
      render(
        <Modal isOpen onClose={onCloseMock} closeOnBackDropClick>
          <ModalHeader closeIcon onClose={onCloseMock} />
        </Modal>,
      ),
    test: () => {
      const backdrop = document.body.querySelectorAll('.tecma-modal-container')[0];
      fireEvent.click(backdrop);
      expect(onCloseMock.mock.calls.length).toEqual(1);
    },
    dataTestId: 'tecma-modal-header',
  });

  performTest({
    description: 'should support closeIcon prop',
    fetchMockImplementation: mockFetchArrowUp as jest.Mock,
    renderer: () =>
      render(
        <Modal isOpen onClose={onCloseMock}>
          <ModalHeader closeIcon onClose={onCloseMock} />
        </Modal>,
      ),
    test: () => {
      expect(document.body.querySelectorAll('.tecma-button')[0]).toMatchSnapshot();
    },
    dataTestId: 'tecma-modal-header',
  });

  describe('Modal Header component', () => {
    performStandardTest(ModalHeader, { 'data-testid': 'tecma-modal-header' }, 'tecma-modal-header');
  });

  describe('Modal Content component', () => {
    performStandardTest(ModalContent, { 'data-testid': 'tecma-modal-content' }, 'tecma-modal-content');
  });

  describe('Modal Footer component', () => {
    performStandardTest(ModalFooter, { 'data-testid': 'tecma-modal-footer' }, 'tecma-modal-footer');
  });
});
