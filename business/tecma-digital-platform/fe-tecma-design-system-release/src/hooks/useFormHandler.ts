import { useForm, UseFormProps, FieldValues, Path, RegisterOptions, PathValue } from 'react-hook-form';

import { EMAIL_REGEX, NAME_REGEX } from '../constants/regex';

export function useFormHandler<TFormFields extends FieldValues>(formHandlerProps: UseFormProps<TFormFields>) {
  const { register, formState, setValue, ...rest } = useForm<TFormFields>({ ...formHandlerProps });

  const emailValidation = (value: PathValue<TFormFields, Path<TFormFields>>) => {
    if (!value) return true;
    return EMAIL_REGEX.test(value);
  };
  const nameValidation = (value: PathValue<TFormFields, Path<TFormFields>>) => {
    return NAME_REGEX.test(value);
  };
  const getFieldFormatValidation = (field: string) => {
    if (field === 'email') {
      return emailValidation;
    }
    if (field === 'name' || field === 'surname') {
      return nameValidation;
    }
    return undefined;
  };
  const getFieldMaxLengthValidation = (field: string) => {
    if (field === 'email') {
      return 100;
    }
    if (field === 'name' || field === 'surname') {
      return 50;
    }
    return undefined;
  };
  const registerWithDefaultValidations = (name: string, options: RegisterOptions<TFormFields>) => {
    return register(name as Path<TFormFields>, {
      maxLength: getFieldMaxLengthValidation(name),
      ...options,
      validate: {
        ...options?.validate,
        pattern: (value) => getFieldFormatValidation(name)?.(value) || `Invalid format for ${name} field`,
      },
      onChange: (event) => {
        if (name === 'email') {
          const trimmedValue = event.target.value.trim();
          setValue(name as Path<TFormFields>, trimmedValue);
        }
        if (options.onChange) {
          options.onChange(event);
        }
      },
    });
  };

  return {
    register,
    registerWithDefaultValidations,
    setValue,
    errors: formState.errors,
    formState,
    ...rest,
  };
}
