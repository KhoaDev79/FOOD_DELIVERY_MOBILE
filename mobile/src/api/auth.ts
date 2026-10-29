import { apiClient } from './client';
import { User } from '../types/api';

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  login: (data: { email: string; password: string }) =>
    apiClient.post<any, AuthResponse>('/auth/login', data),

  register: (data: { email: string; password: string; fullName: string; phone?: string }) =>
    apiClient.post<any, AuthResponse>('/auth/register', { ...data, role: 'CUSTOMER' }),

  logout: () => apiClient.post('/auth/logout'),
};

