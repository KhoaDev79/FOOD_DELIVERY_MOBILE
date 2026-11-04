import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CloudinaryConfig, FOLDER_MAX_WIDTH, IMAGE_MIME, ImageFolder, MAX_IMAGE_BYTES, UploadResult } from './media.types';
import { applyCloudinaryTransformation, isDataUri, parseImageDataUri } from './media.util';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(private readonly config: ConfigService) {}

  private get cloud(): CloudinaryConfig | null {
    const c = this.config.get<CloudinaryConfig>('cloudinary');
    const cloudName = c?.cloudName?.trim() || process.env.CLOUDINARY_CLOUD_NAME?.trim() || '';
    const apiKey = c?.apiKey?.trim() || process.env.CLOUDINARY_API_KEY?.trim() || '';
    const apiSecret = c?.apiSecret?.trim() || process.env.CLOUDINARY_API_SECRET?.trim() || '';
    return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
  }

  get provider(): 'cloudinary' | 'local' {
    return this.cloud ? 'cloudinary' : 'local';
  }

  /**
   * Chuẩn hoá và xử lý trường ảnh:
   * - null / undefined / chuỗi rỗng -> null
   * - data URI base64 -> upload lên Cloudinary (hoặc local) và trả link
   * - link http(s) hoặc /public/... -> giữ nguyên
   */
  async resolveImage(value: string | null | undefined, folder: ImageFolder): Promise<string | null> {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (isDataUri(trimmed)) {
      const uploaded = await this.upload(trimmed, folder);
      return uploaded.url;
    }

    return trimmed;
  }

  /**
   * Tải ảnh dạng data URI lên Cloudinary (hoặc lưu máy chủ nếu chưa cấu hình khoá).
   */
  async upload(dataUri: string, folder: ImageFolder): Promise<UploadResult> {
    const image = parseImageDataUri(dataUri);
    const cloud = this.cloud;

    if (cloud) {
      try {
        const url = await this.uploadToCloudinary(dataUri, folder, cloud);
        return { url, provider: 'cloudinary' };
      } catch (err: any) {
        const msg = String(err?.message || err).replace(/api_key=[^&\s]+/gi, 'api_key=***');
        this.logger.warn(`Tải ảnh lên Cloudinary lỗi (${msg}), chuyển sang lưu trên máy chủ.`);
      }
    }

    return { url: this.saveLocal(image.buffer, image.ext, folder), provider: 'local' };
  }

  /**
   * Tải file từ Buffer (ví dụ: Multer file upload từ avatar).
   */
  async uploadBuffer(buffer: Buffer, mime: string, ext: string, folder: ImageFolder): Promise<UploadResult> {
    const normalizedMime = mime === 'image/jpg' ? 'image/jpeg' : mime;
    if (!(IMAGE_MIME as readonly string[]).includes(normalizedMime as any)) {
      throw new BadRequestException('Chỉ hỗ trợ định dạng JPG, PNG hoặc WebP');
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Kích thước ảnh tối đa là 5 MB');
    }

    const dataUri = `data:${normalizedMime};base64,${buffer.toString('base64')}`;
    return this.upload(dataUri, folder);
  }

  /**
   * Tải lên Cloudinary có chữ ký (signed upload) qua REST API.
   */
  private async uploadToCloudinary(
    dataUri: string,
    folder: ImageFolder,
    cloud: CloudinaryConfig,
  ): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const cloudFolder = `zomzom/${folder}`;
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

    const width = FOLDER_MAX_WIDTH[folder] ?? 800;
    return applyCloudinaryTransformation(String(data.secure_url), width);
  }

  /**
   * Lưu ảnh dự phòng vào thư mục public/uploads/<folder> trên server.
   */
  private saveLocal(buffer: Buffer, ext: string, folder: ImageFolder): string {
    const cleanExt = ext.replace(/^\./, '');
    const dir = join(process.cwd(), 'public', 'uploads', folder);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}.${cleanExt}`;
    writeFileSync(join(dir, filename), buffer);
    return `/public/uploads/${folder}/${filename}`;
  }
}

