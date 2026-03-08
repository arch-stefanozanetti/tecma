export interface LocaleMobileConfig {
  locale?: {
    distanceInWords: (token: any, count: any, options: any) => any;
    format: () => any;
  };
  blank?: string;
  headerFormat?: string;
  todayLabel?: {
    long: string;
  };
  weekdays?: string[];
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
