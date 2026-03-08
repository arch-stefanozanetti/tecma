import React from 'react';

import { Story, Meta } from '@storybook/react';

import { Grid } from '../components/Grid';
import { GridProps } from '../components/Grid/Grid';
import { GridColumnProps } from '../components/Grid/GridColumn';

// 👇 We create a “template” of how args map to rendering
const Template: Story<GridColumnProps> = (args) => {
  return (
    <div
      style={{
        backgroundColor: '#4A5899',
        width: '800px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <Grid>
        <Grid.Column {...args}>
          <div style={{ padding: '1rem', background: '#77B6EA' }}>size: 100%</div>
        </Grid.Column>
      </Grid>
      <Grid>
        <Grid.Column size='6'>
          <div style={{ padding: '1rem', background: '#77B6EA' }}>size: 50%</div>
        </Grid.Column>
        <Grid.Column>
          <div style={{ padding: '1rem', background: '#A3E7FC' }}>size: 50%</div>
        </Grid.Column>
      </Grid>
      <Grid>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA' }}>size: 25%</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#A3E7FC' }}>size: 25%</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA' }}>size: 25%</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#A3E7FC' }}>size: 25%</div>
        </Grid.Column>
      </Grid>
    </div>
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export const Offset: Story<GridColumnProps> = (args) => {
  return (
    <div
      style={{
        backgroundColor: '#4A5899',
        width: '500px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <Grid>
        <Grid.Column {...args} offset={2}>
          <div style={{ padding: '1rem', background: '#77B6EA' }}>Offset 2, size auto</div>
        </Grid.Column>
      </Grid>
      <Grid>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA' }}>size: 25%</div>
        </Grid.Column>
        <Grid.Column offset={4}>
          <div style={{ padding: '1rem', background: '#A3E7FC' }}>Offset 4, size auto</div>
        </Grid.Column>
      </Grid>
    </div>
  );
};
Offset.storyName = 'Offset Usage';

export const Gutter: Story<GridProps> = (args) => {
  return (
    <div
      style={{
        backgroundColor: '#4A5899',
        width: '500px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <Grid {...args}>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA' }}>size: 25%</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#A3E7FC' }}>size: 25%</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA' }}>size: 25%</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA' }}>size: 25%</div>
        </Grid.Column>
      </Grid>
    </div>
  );
};
Gutter.storyName = 'Gutter Usage';
Gutter.args = { gutter: 8 };

export const ItemsAlign: Story<GridProps> = (args) => {
  return (
    <div
      style={{
        backgroundColor: '#4A5899',
        width: '500px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <Grid {...args} gutter={8} itemsAlign='start'>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA', height: '100px' }}>start</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#A3E7FC', height: '100%' }}>start</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA', height: '100%' }}>start</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#A3E7FC', height: '100%' }}>start</div>
        </Grid.Column>
      </Grid>
      <Grid {...args} gutter={8} itemsAlign='center'>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA', height: '100px' }}>center</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#A3E7FC', height: '100%' }}> center</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA', height: '100%' }}>center</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#A3E7FC', height: '100%' }}>center</div>
        </Grid.Column>
      </Grid>
      <Grid {...args} gutter={8} itemsAlign='end'>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA', height: '100px' }}>end</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#A3E7FC', height: '100%' }}>end</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA', height: '100%' }}>end</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#A3E7FC', height: '100%' }}>end</div>
        </Grid.Column>
      </Grid>
      <Grid {...args} gutter={8} itemsAlign='stretch'>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA', height: '100px' }}>stretch</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div
            style={{
              padding: '1rem',
              background: '#A3E7FC',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            stretch
          </div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div
            style={{
              padding: '1rem',
              background: '#77B6EA',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            stretch
          </div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div
            style={{
              padding: '1rem',
              background: '#A3E7FC',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            stretch
          </div>
        </Grid.Column>
      </Grid>
      <Grid {...args} gutter={8} itemsAlign='baseline'>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA', height: '100px' }}>baseline</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#A3E7FC', height: '100%' }}>baseline</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#77B6EA', height: '100%' }}>baseline</div>
        </Grid.Column>
        <Grid.Column size='3'>
          <div style={{ padding: '1rem', background: '#A3E7FC', height: '100%' }}>baseline</div>
        </Grid.Column>
      </Grid>
    </div>
  );
};
ItemsAlign.storyName = 'ItemsAlign Usage';

export default {
  title: 'Components/Grid',
  component: Grid,
  argTypes: {},
} as Meta<typeof Grid>;
