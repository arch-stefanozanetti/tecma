export type DevChannelEntry = {
  id: string;
  gitBranch: string;
  label: string;
  description: string;
  basePath: string;
  apiBaseUrlOverride?: string;
};
