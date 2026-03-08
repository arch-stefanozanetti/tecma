// STYLES - Colors and Typography
export * from './styles/colors';
export * from './styles/fonts';
export * from './styles/dimensions';

// COMPONENTS
export { Accordion } from './components/Accordion';
export { Avatar } from './components/Avatar';
export { Button } from './components/Button';
export { Card } from './components/Card';
export { Carousel } from './components/Carousel';
export { Checkbox } from './components/Checkbox';
export { Sidebar } from './components/Sidebar';
export { DropDown } from './components/DropDown';
export { FloatingContent } from './components/_FloatingContent';
export { Icon, IconURLContext } from './components/Icon';
export { Input } from './components/Input';
export { LazyImage } from './components/LazyImage';
export { Modal } from './components/Modal';
export { Portal } from './components/_Portal';
export { Spinner } from './components/Spinner';
export { Tooltip } from './components/Tooltip';
export { ValuePicker } from './components/ValuePicker';
export { Toggle } from './components/Toggle';
export { RadioButton } from './components/RadioButton';
export { ButtonGroup } from './components/ButtonGroup';
export { TextArea } from './components/TextArea';
export { ProgressBar } from './components/ProgressBar';
export { Slider } from './components/Slider';
export { Tab } from './components/Tab';
export { Tag } from './components/Tag';
export { Select } from './components/Select';
export { Alert } from './components/Alert';
export { Grid } from './components/Grid';
export { Pagination } from './components/Pagination';
export { ProgressIndicator } from './components/ProgressIndicator';
export { Divider } from './components/Divider';
export { RadioGroup } from './components/RadioGroup';
export { Radio } from './components/Radio';
export { Stepper } from './components/Stepper';
export { DatePicker } from './components/DatePicker';
export { default as DatePickerMobile } from './components/DatePicker/DatePickerMobile';
export { DateRangePicker } from './components/DateRangePicker';
export { LanguageSelector } from './components/LanguageSelector';
export { CheckboxGroup } from './components/CheckboxGroup';
export { Snackbar } from './components/Snackbar';
export { Drawer } from './components/Drawer';
export { Popover } from './components/Popover';
export { Header } from './components/Header';
export { PhoneInput } from './components/PhoneInput';
export { SearchBar } from './components/SearchBar';
export { TableMaterial } from './components/TableMaterial';
export { TimePicker } from './components/TimePicker/TimePicker';
export { SelectDynamicMultiple } from './components/SelectDynamicMultiple/Select.DynamicMultiple';
export { SelectDynamic } from './components/SelectDynamic/Select.Dynamic';
export { TecmaSidebar } from './components/TecmaSidebar';
export { TecmaSidebarMobile } from './components/TecmaSidebarMobile';
export { TecmaHeader } from './components/TecmaHeader';
export { TecmaHeaderMobile } from './components/TecmaHeaderMobile';
export { NavigationItem } from './components/NavigationItem';

// VIEWS
export { MissingPage } from './components/MissingPage';
export { ErrorPage } from './components/ErrorPage';
export { LoaderPage } from './components/LoaderPage';

// PROJECT COMPONENTS
export { SidebarBSSPlatformTools } from './components/SidebarBSSPlatformTools';

// FUNCTIONS
export { visibleTools } from './helpers/visibleTools';

// HOOKS
export { useDebounce } from './hooks/useDebounce';
export { useDebounceFn } from './hooks/useDebounce';
export { useDevice } from './hooks/useDevice';
export { useFormHandler } from './hooks/useFormHandler';
export { useId } from './hooks/useId';
export { useListValue } from './hooks/useListValue';
export { useScaleFactor } from './hooks/useScaleFactor';

// HELPERS
export { delay } from './helpers/asyncUtils';
export { DatesFormatter, DatesFormatterRange } from './helpers/datesFormatter';
export { phoneInputCountries, getCountryAndPrefix, translateSelectedValue, isValidNumber } from './helpers/phone-input';

// TYPES
export type { SubmitHandler } from 'react-hook-form';
export type { PhoneCountry } from './helpers/phone-input';
export type { Locales } from './constants/locales';
export type { OptionSelect } from './components/Select/Select';
export type { AlertType } from './components/Alert/Alert';
export type { HeaderAction } from './components/TecmaHeader/TecmaHeader';
export type { SizeExtended } from './declarations/size';
export type { SizeStandard } from './declarations/size';

// CONTEXT
export { DeviceContext } from './context/device';

// NOTE: TO be removed, needed to deploy the library
export { Test } from './components/Test';
