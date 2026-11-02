import { BadRequestException } from '@nestjs/common';
import {
  assertSchedule,
  bannerStatus,
  normalizeBannerAction,
  normalizeKeywords,
  parseImageDataUri,
  slugifyCode,
} from './content-rules';

const now = new Date('2026-11-02T10:00:00Z');
const day = 24 * 60 * 60 * 1000;

describe('bannerStatus', () => {
  it('tắt thì là OFF dù đang trong lịch', () => {
    expect(bannerStatus({ isActive: false }, now)).toBe('OFF');
  });
  it('chưa tới ngày bắt đầu là SCHEDULED, quá ngày kết thúc là EXPIRED', () => {
    expect(bannerStatus({ isActive: true, startAt: new Date(now.getTime() + day) }, now)).toBe('SCHEDULED');
    expect(bannerStatus({ isActive: true, endAt: new Date(now.getTime() - day) }, now)).toBe('EXPIRED');
  });
  it('không có lịch hoặc đang trong lịch là LIVE', () => {
    expect(bannerStatus({ isActive: true }, now)).toBe('LIVE');
    expect(
      bannerStatus({ isActive: true, startAt: new Date(now.getTime() - day), endAt: new Date(now.getTime() + day) }, now),
    ).toBe('LIVE');
  });
});

describe('assertSchedule', () => {
  it('báo lỗi khi ngày kết thúc không sau ngày bắt đầu', () => {
    expect(() => assertSchedule(now, now)).toThrow(BadRequestException);
    expect(() => assertSchedule(now, new Date(now.getTime() + day))).not.toThrow();
  });
});

describe('normalizeBannerAction', () => {
  it('giá trị cũ (COLLECTION) hoặc thiếu đích đến thì thành NONE', () => {
    expect(normalizeBannerAction('COLLECTION', 'abc')).toEqual({ actionType: 'NONE', actionValue: null });
    expect(normalizeBannerAction('RESTAURANT', '  ')).toEqual({ actionType: 'NONE', actionValue: null });
  });
  it('giữ hành động hợp lệ', () => {
    expect(normalizeBannerAction('SEARCH', ' trà sữa ')).toEqual({ actionType: 'SEARCH', actionValue: 'trà sữa' });
  });
});

describe('slugifyCode & normalizeKeywords', () => {
  it('tạo mã không dấu từ tên tiếng Việt', () => {
    expect(slugifyCode('Chè - Đồ ngọt')).toBe('che-do-ngot');
    expect(slugifyCode('   ')).toBe('danh-muc');
  });
  it('bỏ trống, bỏ trùng, chữ thường', () => {
    expect(normalizeKeywords([' Bún ', 'bún', '', 'Phở  bò'])).toEqual(['bún', 'phở bò']);
  });
});

describe('parseImageDataUri', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
  it('nhận ảnh PNG/JPG/WebP hợp lệ', () => {
    expect(parseImageDataUri(`data:image/png;base64,${png}`).ext).toBe('png');
    expect(parseImageDataUri(`data:image/jpg;base64,${png}`).mime).toBe('image/jpeg');
  });
  it('từ chối định dạng khác và chuỗi không phải ảnh', () => {
    expect(() => parseImageDataUri(`data:image/gif;base64,${png}`)).toThrow('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
    expect(() => parseImageDataUri('https://example.com/a.png')).toThrow('Ảnh không hợp lệ');
  });
  it('từ chối ảnh quá 5 MB', () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64');
    expect(() => parseImageDataUri(`data:image/jpeg;base64,${big}`)).toThrow('Ảnh tối đa 5 MB');
  });
});
