import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseImageDataUri } from './content-rules';

export type ImageFolder = 'banners' | 'cuisines';

/**
 * Lưu ảnh nội dung (banner, danh mục):
 * - Có khoá Cloudinary: tải lên Cloudinary, trả link CDN tự chọn định dạng/chất lượng (f_auto,q_auto)
 *   và giới hạn chiều rộng để trang chủ tải nhanh.
 * - Không có khoá hoặc Cloudinary lỗi: lưu vào public/uploads/<folder> trên máy chủ (đã gắn volume Docker).
 */
@Injectable()
export class ImageStorageService {
  private readonly logger = new Logger(ImageStorageService.name);

  constructor(private readonly config: ConfigService) {}

  private get cloud() {
    const c = this.config.get<{ cloudName: string; apiKey: string; apiSecret: string }>('cloudinary');
    const cloudName = c?.cloudName?.trim() || process.env.CLOUDINARY_CLOUD_NAME?.trim() || '';
    const apiKey = c?.apiKey?.trim() || process.env.CLOUDINARY_API_KEY?.trim() || '';
    const apiSecret = c?.apiSecret?.trim() || process.env.CLOUDINARY_API_SECRET?.trim() || '';
    return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
  }

  get provider(): 'cloudinary' | 'local' {
    return this.cloud ? 'cloudinary' : 'local';
  }

  async upload(dataUri: string, folder: ImageFolder): Promise<{ url: string; provider: 'cloudinary' | 'local' }> {
    const image = parseImageDataUri(dataUri);
    const cloud = this.cloud;
    if (cloud) {
      try {
        return { url: await this.uploadCloudinary(dataUri, folder, cloud), provider: 'cloudinary' };
      } catch (err: any) {
        const msg = String(err?.message || err).replace(/api_key=[^&\s]+/gi, 'api_key=***');
        this.logger.warn(`Tải ảnh lên Cloudinary lỗi (${msg}), lưu tạm trên máy chủ.`);
      }
    }
    return { url: this.saveLocal(image.buffer, image.ext, folder), provider: 'local' };
  }

  /** Tải lên có chữ ký (signed upload) bằng REST API, không cần thư viện riêng. */
  private async uploadCloudinary(
    dataUri: string,
    folder: ImageFolder,
    cloud: { cloudName: string; apiKey: string; apiSecret: string },
  ): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const cloudFolder = `zomzom/${folder}`;
    // Chữ ký: các tham số sắp theo bảng chữ cái, nối "&", thêm secret, băm SHA-1
    const signature = createHash('sha1')
      .update(`folder=${cloudFolder}&timestamp=${timestamp}${cloud.apiSecret}`)
      .digest('hex');

    const form = new FormData();
    form.append('file', dataUri);
    form.append('api_key', cloud.apiKey);
    form.append('timestamp', String(timestamp));
    form.append('folder', cloudFolder);
    form.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud.cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data?.secure_url) {
      throw new Error(data?.error?.message || `HTTP ${res.status}`);
    }
    // Link phát ảnh: tự chọn định dạng (WebP/AVIF), nén vừa phải, giới hạn rộng theo loại ảnh
    const width = folder === 'banners' ? 1600 : 600;
    return String(data.secure_url).replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
  }

  private saveLocal(buffer: Buffer, ext: string, folder: ImageFolder): string {
    const dir = join(process.cwd(), 'public', 'uploads', folder);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    writeFileSync(join(dir, filename), buffer);
    return `/public/uploads/${folder}/${filename}`;
  }
}
