import { apiClient } from './client';
import {
  DriverLedgerEntry,
  DriverLedgerResponse,
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

  getMyLedger: (params?: { page?: number; limit?: number }) =>
    apiClient.get<any, DriverLedgerResponse>('/drivers/me/ledger', { params }),

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

  adminListDriverLedgers: (params?: { minBalance?: number; page?: number; limit?: number }) =>
    apiClient.get<
      any,
      PaginatedResult<DriverProfile> & { debtLimit: number; totalDebt: number }
    >('/admin/drivers/ledger', { params }),

  adminGetDriverLedger: (userId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get<any, DriverLedgerResponse>(`/admin/drivers/${userId}/ledger`, { params }),

  adminRecordSettlement: (userId: string, payload: { amount: number; note?: string }) =>
    apiClient.post<any, { entry: DriverLedgerEntry; balance: number; limit: number }>(
      `/admin/drivers/${userId}/settlements`,
      payload,
    ),

  adminRecordAdjustment: (userId: string, payload: { amount: number; note: string }) =>
    apiClient.post<any, { entry: DriverLedgerEntry; balance: number; limit: number }>(
      `/admin/drivers/${userId}/adjustments`,
      payload,
    ),

  adminVerifyDriver: (userId: string, payload: AdminVerifyDriverPayload) =>
    apiClient.patch<any, DriverProfile>(`/admin/drivers/${userId}/verify`, payload),
};
