import { apiClient } from './client';
import { CuisineCategory } from '../types/api';

/** Bấm vào banner thì đi đâu. */
export type BannerAction = 'NONE' | 'RESTAURANT' | 'CUISINE' | 'SEARCH';
export type BannerStatus = 'LIVE' | 'SCHEDULED' | 'EXPIRED' | 'OFF';

export interface AdminBanner {
  id: string;
  title: string;
  imageUrl: string;
  actionType: BannerAction;
  actionValue: string | null;
  sortOrder: number;
  isActive: boolean;
  startAt: string | null;
  endAt: string | null;
  status: BannerStatus;
}

export interface AdminCuisine extends CuisineCategory {
  isActive: boolean;
}

export interface BannerInput {
  title?: string;
  imageUrl?: string;
  actionType?: BannerAction;
  actionValue?: string | null;
  isActive?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}

export interface CuisineInput {
  name?: string;
  imageUrl?: string;
  keywords?: string[];
  isActive?: boolean;
}

/** Quản lý nội dung trang chủ (chỉ quản trị viên). */
export const adminContentApi = {
  /** Tải ảnh (data URI base64) lên; trả link ảnh trên Cloudinary hoặc máy chủ. */
  uploadImage: (dataUri: string, folder: 'banners' | 'cuisines') =>
    apiClient.post<any, { url: string; provider: 'cloudinary' | 'local' }>('/admin/content/images', { dataUri, folder }),

  listBanners: () => apiClient.get<any, AdminBanner[]>('/admin/content/banners'),
  createBanner: (data: BannerInput) => apiClient.post<any, AdminBanner>('/admin/content/banners', data),
  updateBanner: (id: string, data: BannerInput) => apiClient.patch<any, AdminBanner>(`/admin/content/banners/${id}`, data),
  deleteBanner: (id: string) => apiClient.delete(`/admin/content/banners/${id}`),
  reorderBanners: (ids: string[]) => apiClient.post<any, AdminBanner[]>('/admin/content/banners/reorder', { ids }),

  listCuisines: () => apiClient.get<any, AdminCuisine[]>('/admin/content/cuisines'),
  createCuisine: (data: CuisineInput) => apiClient.post<any, AdminCuisine>('/admin/content/cuisines', data),
  updateCuisine: (id: string, data: CuisineInput) =>
    apiClient.patch<any, AdminCuisine>(`/admin/content/cuisines/${id}`, data),
  deleteCuisine: (id: string) => apiClient.delete(`/admin/content/cuisines/${id}`),
  reorderCuisines: (ids: string[]) => apiClient.post<any, AdminCuisine[]>('/admin/content/cuisines/reorder', { ids }),
};
