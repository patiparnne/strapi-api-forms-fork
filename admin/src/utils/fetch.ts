import { PLUGIN_ID } from '../pluginId';

const fetchInstance = async (
  endpoint: string,
  token: string,
  method: string,
  options?: object | null,
  formData?: object | null,
  isAdmin?: boolean
) => {
  const route = `${isAdmin ? '/' : '/api/'}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Only add Authorization header if token is provided
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(
      `${route}${PLUGIN_ID}/${endpoint}${options ? `?${new URLSearchParams({ ...options })}` : ''}`,
      {
        method,
        mode: 'cors',
        headers,
        body: formData && JSON.stringify({ data: formData }),
      }
    );
  } catch (error) {
    console.error('Fetch error:', error);
    throw new Error(`Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export default fetchInstance;
