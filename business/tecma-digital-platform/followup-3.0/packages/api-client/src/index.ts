export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  getApiKey?: () => string | null;
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`POST ${path} failed: ${response.status}`);
    return response.json() as Promise<T>;
  }

  private headers(): Record<string, string> {
    const token = this.options.getAccessToken?.();
    const apiKey = this.options.getApiKey?.();
    return {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    };
  }
}
