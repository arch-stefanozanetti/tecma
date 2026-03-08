import type { Meta, StoryObj } from '@storybook/react';
import IconViewer from '../components/IconViewer';

const meta: Meta<typeof IconViewer> = {
  title: 'Utilities/IconViewer',
  component: IconViewer,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof IconViewer>;

export const AllIcons: Story = {
  name: 'Tutte le icone disponibili',
}; 