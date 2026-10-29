declare module 'expo-image-picker' {
  export interface ImagePickerAsset {
    uri: string;
    width?: number;
    height?: number;
    type?: 'image' | 'video';
    fileName?: string;
    fileSize?: number;
    base64?: string | null;
  }

  export interface ImagePickerResult {
    canceled: boolean;
    assets: ImagePickerAsset[] | null;
  }

  export enum MediaTypeOptions {
    All = 'All',
    Videos = 'Videos',
    Images = 'Images',
  }

  export function requestMediaLibraryPermissionsAsync(): Promise<{ status: string; granted: boolean }>;
  export function launchImageLibraryAsync(options?: any): Promise<ImagePickerResult>;
  export function launchCameraAsync(options?: any): Promise<ImagePickerResult>;
}
