import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReviewOrderDto } from '../orders/dto/orders.dto';
import { toggleHiddenImage, visibleImages } from './review-images';

describe('review-images', () => {
  it('ảnh bị ẩn không hiện công khai', () => {
    expect(visibleImages(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
    expect(visibleImages(['a'], [])).toEqual(['a']);
  });

  it('ẩn / hiện lại ảnh không tạo trùng lặp', () => {
    expect(toggleHiddenImage(['a'], 'a', true)).toEqual(['a']);
    expect(toggleHiddenImage(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleHiddenImage(['a', 'b'], 'a', false)).toEqual(['b']);
  });

  it('DTO đánh giá: tối đa 3 ảnh, chỉ nhận ảnh JPG/PNG/WEBP', async () => {
    const ok = plainToInstance(ReviewOrderDto, { rating: 5, images: ['data:image/jpeg;base64,AAA'] });
    expect(await validate(ok)).toHaveLength(0);

    const tooMany = plainToInstance(ReviewOrderDto, { rating: 5, images: Array(4).fill('data:image/png;base64,A') });
    expect((await validate(tooMany))[0].constraints).toHaveProperty('arrayMaxSize');

    const badType = plainToInstance(ReviewOrderDto, { rating: 5, images: ['data:text/html;base64,PHNjcmlwdD4='] });
    expect((await validate(badType))[0].constraints).toHaveProperty('matches');
  });
});
