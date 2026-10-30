import { apiClient } from './client';
import {
  DriverProfile,
  DriverVerificationStatus,
  PaginatedResult,
  VehicleType,
} from '../types/api';

export interface UpdateDriverVehiclePayload {
  vehicleType?: VehicleType;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
  driverLicenseClass?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
}

export interface UpdateDriverStatusPayload {
  isOnline: boolean;
  latitude?: number;
  longitude?: number;
}

export interface UpdateDriverLocationPayload {
  latitude: number;
  longitude: number;
}

export interface AdminVerifyDriverPayload {
  status: DriverVerificationStatus;
  reason?: string;
}

export const driversApi = {
  getMe: () => apiClient.get<any, DriverProfile>('/drivers/me'),

  updateVehicle: (payload: UpdateDriverVehiclePayload) =>
    apiClient.patch<any, DriverProfile>('/drivers/me/vehicle', payload),

  updateStatus: (payload: UpdateDriverStatusPayload) =>
    apiClient.patch<any, DriverProfile>('/drivers/me/status', payload),

  updateLocation: (payload: UpdateDriverLocationPayload) =>
    apiClient.patch<any, { success: boolean }>('/drivers/me/location', payload),

  // ===================== ADMIN ENDPOINTS =====================
  adminListDrivers: (params?: {
    status?: DriverVerificationStatus;
    page?: number;
    limit?: number;
  }) => apiClient.get<any, PaginatedResult<DriverProfile>>('/admin/drivers', { params }),

  adminVerifyDriver: (userId: string, payload: AdminVerifyDriverPayload) =>
    apiClient.patch<any, DriverProfile>(`/admin/drivers/${userId}/verify`, payload),
};

