import { Country, getCountries, getCountryCallingCode, isPossiblePhoneNumber, isValidPhoneNumber } from 'react-phone-number-input';

import { Locales, locales } from '../constants/locales';
import { OptionSelect } from '../components/Select/Select';

export type PhoneCountry = Country;

export const phoneInputCountries = (currentLanguage: Locales): OptionSelect[] =>
  getCountries()
    .map((country) => ({
      label: `${locales[currentLanguage][country]} +${getCountryCallingCode(country)}`,
      value: country,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

export const getCountryAndPrefix = (defaultCountry: PhoneCountry, currentLanguage: Locales): OptionSelect =>
  phoneInputCountries(currentLanguage).find((country) => country.value === defaultCountry) as OptionSelect;

export const translateSelectedValue = (selectedValue: OptionSelect, currentLanguage: Locales, short?: boolean) => {
  const countryName = short ? selectedValue.value.toUpperCase() : locales[currentLanguage][selectedValue.value];
  return {
    label: `${countryName} (+${getCountryCallingCode(selectedValue.value as PhoneCountry)})`,
    value: selectedValue.value,
  };
};

export const isValidNumber = (selectedCountry: PhoneCountry, phoneNumber: string) =>
  isPossiblePhoneNumber(`+${getCountryCallingCode(selectedCountry) + phoneNumber}`) &&
  isValidPhoneNumber(`+${getCountryCallingCode(selectedCountry) + phoneNumber}`);
