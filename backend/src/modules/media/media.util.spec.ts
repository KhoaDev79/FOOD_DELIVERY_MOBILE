import { BadRequestException } from '@nestjs/common';
import { applyCloudinaryTransformation, isCloudinaryUrl, isDataUri, parseImageDataUri } from './media.util';

describe('media.util', () => {
  describe('parseImageDataUri', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

    it('giải mã đúng data URI của ảnh PNG', () => {
      const res = parseImageDataUri(`data:image/png;base64,${pngHeader}`);
      expect(res.ext).toBe('png');
      expect(res.mime).toBe('image/png');
      expect(res.buffer).toBeInstanceOf(Buffer);
    });

    it('báo lỗi khi data URI không đúng cú pháp', () => {
      expect(() => parseImageDataUri('http://example.com/img.png')).toThrow(BadRequestException);
      expect(() => parseImageDataUri('')).toThrow(BadRequestException);
    });

    it('báo lỗi khi định dạng không được hỗ trợ (vd gif)', () => {
      expect(() => parseImageDataUri('data:image/gif;base64,R0lGODlh')).toThrow(BadRequestException);
    });
  });

  describe('isCloudinaryUrl & isDataUri', () => {
    it('nhận diện chính xác URL Cloudinary', () => {
      expect(isCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(true);
      expect(isCloudinaryUrl('/public/uploads/dish.jpg')).toBe(false);
      expect(isCloudinaryUrl(null)).toBe(false);
    });

    it('nhận diện chính xác chuỗi data URI', () => {
      expect(isDataUri('data:image/jpeg;base64,/9j/4AAQSkZJRg...')).toBe(true);
      expect(isDataUri('https://example.com/a.jpg')).toBe(false);
      expect(isDataUri('')).toBe(false);
    });
  });

  describe('applyCloudinaryTransformation', () => {
    it('chèn tham số f_auto,q_auto,c_limit,w_X vào sau /upload/', () => {
      const original = 'https://res.cloudinary.com/demo/image/upload/v12345/zomzom/dishes/pho.jpg';
      const transformed = applyCloudinaryTransformation(original, 800);
      expect(transformed).toBe(
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_800/v12345/zomzom/dishes/pho.jpg',
      );
    });

    it('không chèn trùng nếu URL đã có f_auto,q_auto', () => {
      const original = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_800/v12345/zomzom/dishes/pho.jpg';
      expect(applyCloudinaryTransformation(original, 800)).toBe(original);
    });
  });
});

