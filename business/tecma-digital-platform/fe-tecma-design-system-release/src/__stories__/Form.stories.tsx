import React from 'react';

import { Meta, Story } from '@storybook/react';
import { FieldValues, SubmitHandler } from 'react-hook-form';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useFormHandler } from '../hooks/useFormHandler';

interface FormFields {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
}

// 👇 We create a “template” of how args map to rendering
const Template: Story = (args) => {
  const {
    handleSubmit,
    register,
    registerWithDefaultValidations,
    formState: { errors },
  } = useFormHandler<FormFields>({
    mode: 'onBlur',
  });
  const onSubmit: SubmitHandler<FieldValues> = (formData: FieldValues) => {
    // eslint-disable-next-line no-alert
    alert(`Form Data: ${JSON.stringify(formData)}`);
  };
  const getCommonProps = (field: keyof FieldValues) => {
    return {
      id: field,
      label: field,
      placeholder: field,
      status: errors[field] ? 'error' : (undefined as 'error' | undefined),
      helpText: errors[field]?.message,
    };
  };
  return (
    <form {...args} onSubmit={handleSubmit(onSubmit)}>
      <Input {...getCommonProps('name')} {...register('name', { required: true })} />
      <Input
        {...getCommonProps('surname')}
        {...registerWithDefaultValidations('surname', {
          required: true,
        })}
      />
      <Input {...getCommonProps('email')} {...registerWithDefaultValidations('email', { required: true })} />
      <br />
      <Button onClick={handleSubmit(onSubmit)} fluid>
        Submit
      </Button>
    </form>
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export default {
  parameters: {
    componentSubtitle: `Example of use of useFormHandler, a form validation hook.`,
    docs: {
      description: {
        component: `useFormHandler is basically useForm but with some extra validation implemented by default for specific fields.<br/>
      **To use this extra validations utilize registerWithDefaultValidations() instead of register().**`,
      },
    },
    design: {
      type: 'figma',
      url: '',
    },
  },
  argTypes: {},
} as Meta;
