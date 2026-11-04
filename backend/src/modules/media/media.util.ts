import { BadRequestException } from '@nestjs/common';
import { IMAGE_MIME, MAX_IMAGE_BYTES } from './media.types';

/** Kiểm tra và giải mã ảnh gửi lên dạng data URI: chỉ JPG/PNG/WebP, tối đa 5 MB. */
export function parseImageDataUri(dataUri: string): { mime: string; buffer: Buffer; ext: string } {
  if (!dataUri || typeof dataUri !== 'string') {
    throw new BadRequestException('Ảnh không hợp lệ');
  }
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUri.trim());
  if (!m) throw new BadRequestException('Ảnh không hợp lệ');

  const mime = m[1] === 'image/jpg' ? 'image/jpeg' : m[1];
  if (!(IMAGE_MIME as readonly string[]).includes(mime)) {
    throw new BadRequestException('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
  }

  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length === 0) throw new BadRequestException('Ảnh rỗng');
  if (buffer.length > MAX_IMAGE_BYTES) throw new BadRequestException('Ảnh tối đa 5 MB');

  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return { mime, buffer, ext };
}

export function isCloudinaryUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('cloudinary.com/');
}

export function isDataUri(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.trim().startsWith('data:image/');
}

/** Gắn thông số tối ưu CDN: tự chọn WebP/AVIF, nén tự động và giới hạn chiều rộng. */
export function applyCloudinaryTransformation(secureUrl: string, width: number): string {
  if (!secureUrl || typeof secureUrl !== 'string') return secureUrl;
  if (secureUrl.includes('f_auto,q_auto')) return secureUrl;
  return secureUrl.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}
