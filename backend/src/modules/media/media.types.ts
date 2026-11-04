export type ImageFolder =
  | 'avatars'
  | 'restaurants'
  | 'dishes'
  | 'banners'
  | 'cuisines'
  | 'reviews'
  | 'support';

/** Giới hạn chiều rộng ảnh theo loại để tối ưu kích thước tải trên mobile và web */
export const FOLDER_MAX_WIDTH: Record<ImageFolder, number> = {
  banners: 1600,
  restaurants: 1200,
  dishes: 800,
  avatars: 400,
  cuisines: 400,
  reviews: 800,
  support: 800,
};

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadResult {
  url: string;
  provider: 'cloudinary' | 'local';
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

