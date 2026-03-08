import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { Button } from '../components/Button';
import TableMaterial, { TableMaterialProps } from '../components/TableMaterial/TableMaterial';

// 👇 We create a “template” of how args map to rendering
const Template: Story<TableMaterialProps> = (args) => {
  const mockColumns = [
    {
      field: 'user',
      title: 'Utente',
      render: (data) => (
        <Button onClick={() => {}} className='TEST'>
          {data.user}
        </Button>
      ),
    },
    {
      field: 'phone',
      title: 'Numero di telefono',
      sort: false,
    },
    {
      field: 'email',
      title: 'Email',
    },
    {
      field: 'status',
      title: 'Status',
    },
  ];
  const mockData = [
    {
      user: 'John Doe 1',
      email: 'test@test.com',
      phone: '1234567890',
    },
    {
      user: 'John Doe 2',
      email: 'test@test.com',
    },
    {
      user: 'John Doe 3',
      email: 'test@test.com',
    },
    {
      user: 'John Doe 4',
      email: 'test@test.com',
    },
    {
      user: 'John Doe 5',
      email: 'test@test.com',
    },
    {
      user: 'John Doe 6',
      email: 'test@test.com',
    },
  ];
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [totalDocs, setTotalDocs] = useState(20);
  const totalPages = Math.ceil(totalDocs / pageSize);

  const handleSortChange = (column: string, direction) => {
    console.log('COLUMN: ', column);
    console.log('DIR: ', direction);
  };
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(0);
  };

  return (
    <TableMaterial
      {...args}
      data={mockData}
      columns={mockColumns}
      page={page}
      onChangePage={handlePageChange}
      onChangeRowsPerPage={handlePageSizeChange}
      onSortChange={handleSortChange}
      pageSize={pageSize}
      pageSizeOptions={[5, 10, 25]}
      totalPages={totalPages}
      title='Table'
      pageSizeLabel='PAGINA'
      totalCountLabel={
        <div>
          Risultati <strong>23</strong>
        </div>
      }
      // useBackendPagination={false}
      // isLoading
      toolbarActions={
        <Button onClick={() => {}} iconName='refresh' color='secondary'>
          Refresh
        </Button>
      }
    />
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export default {
  title: 'Components/TableMaterial',
  component: TableMaterial,
  parameters: {
    componentSubtitle: 'Generic table',
    design: {
      type: 'figma',
      url: '',
    },
  },
  argTypes: {},
} as Meta<typeof TableMaterial>;
