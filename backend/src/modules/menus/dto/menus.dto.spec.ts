import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMenuItemDto, UpdateMenuItemDto } from './menus.dto';

describe('Menus DTO Validation', () => {
  it('UpdateMenuItemDto cho phép availableFrom và availableTo hợp lệ', async () => {
    const dto = plainToInstance(UpdateMenuItemDto, {
      name: 'Bún bò',
      price: 45000,
      availableFrom: '06:00',
      availableTo: '10:30',
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toHaveLength(0);
  });

  it('UpdateMenuItemDto cho phép availableFrom và availableTo là null', async () => {
    const dto = plainToInstance(UpdateMenuItemDto, {
      availableFrom: null,
      availableTo: null,
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toHaveLength(0);
  });

  it('UpdateMenuItemDto báo lỗi nếu định dạng giờ sai', async () => {
    const dto = plainToInstance(UpdateMenuItemDto, {
      availableFrom: '25:99',
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('availableFrom');
  });

  it('CreateMenuItemDto cho phép availableFrom và availableTo hợp lệ', async () => {
    const dto = plainToInstance(CreateMenuItemDto, {
      name: 'Bún chả',
      price: 50000,
      availableFrom: '06:00',
      availableTo: '10:30',
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toHaveLength(0);
  });
});

