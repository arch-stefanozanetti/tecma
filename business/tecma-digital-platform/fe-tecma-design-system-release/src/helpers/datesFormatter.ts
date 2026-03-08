export const DatesFormatter = (
  date: number | Date | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  localeLang?: string,
) => {
  const language = localeLang ?? window.localStorage.getItem('i18nextLng') ?? 'it-IT';
  return new Intl.DateTimeFormat(language, options).format(date);
};

export const DatesFormatterRange = (
  startDate: number | bigint | Date,
  endDate: number | bigint | Date,
  options: Intl.DateTimeFormatOptions = { year: '2-digit', month: 'numeric', day: 'numeric' },
  localeLang?: string,
) => {
  const language = localeLang ?? window.localStorage.getItem('i18nextLng') ?? 'it-IT';
  return new Intl.DateTimeFormat(language, options).formatRange(startDate, endDate);
};
