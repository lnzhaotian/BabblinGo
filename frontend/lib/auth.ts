import { config } from './config';

export async function registerUser({ email, password, displayName }: {
  email: string;
  password: string;
  displayName: string;
}) {
  const response = await fetch(`${config.apiUrl}/api/users/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password, displayName }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || `Registration failed (${response.status})`);
  }

  return response.json();
}

export async function loginUser({ email, password }: {
  email: string;
  password: string;
}) {
  const response = await fetch(`${config.apiUrl}/api/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || `Login failed (${response.status})`);
  }

  return response.json();
}
