import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'cloudinary') {
                return {
                  cloudName: 'test-cloud',
                  apiKey: 'test-key',
                  apiSecret: 'test-secret',
                };
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  describe('resolveImage', () => {
    it('trả về null nếu value là null, undefined hoặc chuỗi rỗng', async () => {
      expect(await service.resolveImage(null, 'dishes')).toBeNull();
      expect(await service.resolveImage(undefined, 'dishes')).toBeNull();
      expect(await service.resolveImage('   ', 'dishes')).toBeNull();
    });

    it('giữ nguyên URL http, https hoặc đường dẫn cục bộ /public/...', async () => {
      const httpsUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
      const localUrl = '/public/images/food/pho.jpg';
      expect(await service.resolveImage(httpsUrl, 'dishes')).toBe(httpsUrl);
      expect(await service.resolveImage(localUrl, 'dishes')).toBe(localUrl);
    });

    it('gọi upload nếu value là data URI hợp lệ', async () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
      const dataUri = `data:image/png;base64,${pngHeader}`;

      jest.spyOn(service, 'upload').mockResolvedValueOnce({
        url: 'https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_limit,w_800/zomzom/dishes/mock.png',
        provider: 'cloudinary',
      });

      const res = await service.resolveImage(dataUri, 'dishes');
      expect(res).toBe(
        'https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_limit,w_800/zomzom/dishes/mock.png',
      );
    });
  });

  describe('uploadBuffer', () => {
    it('báo lỗi nếu định dạng mime không hợp lệ', async () => {
      const buf = Buffer.from('hello');
      await expect(service.uploadBuffer(buf, 'image/gif', 'gif', 'avatars')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('chuyển buffer thành dataUri và upload thành công', async () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      jest.spyOn(service, 'upload').mockResolvedValueOnce({
        url: 'https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_limit,w_400/zomzom/avatars/user.png',
        provider: 'cloudinary',
      });

      const res = await service.uploadBuffer(buf, 'image/png', 'png', 'avatars');
      expect(res.provider).toBe('cloudinary');
      expect(res.url).toContain('/zomzom/avatars/user.png');
    });
  });
});
