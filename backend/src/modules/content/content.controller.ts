import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ContentService } from './content.service';
import {
  CreateBannerDto,
  CreateCuisineDto,
  ReorderDto,
  UpdateBannerDto,
  UpdateCuisineDto,
  UploadImageDto,
} from './dto/content.dto';
import { ImageStorageService } from './image-storage.service';

/** Quản lý nội dung trang chủ: chỉ quản trị viên. */
@Roles(Role.ADMIN)
@Controller('admin/content')
export class ContentController {
  constructor(
    private readonly content: ContentService,
    private readonly images: ImageStorageService,
  ) {}

  /** Tải ảnh lên (Cloudinary nếu có khoá, không thì lưu trên máy chủ). Trả về link ảnh. */
  @Post('images')
  uploadImage(@Body() dto: UploadImageDto) {
    return this.images.upload(dto.dataUri, dto.folder);
  }

  // Banner
  @Get('banners')
  listBanners() {
    return this.content.listBanners();
  }

  @Post('banners')
  createBanner(@CurrentUser('id') userId: string, @Body() dto: CreateBannerDto) {
    return this.content.createBanner(userId, dto);
  }

  @Post('banners/reorder')
  reorderBanners(@CurrentUser('id') userId: string, @Body() dto: ReorderDto) {
    return this.content.reorderBanners(userId, dto.ids);
  }

  @Patch('banners/:id')
  updateBanner(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBannerDto) {
    return this.content.updateBanner(userId, id, dto);
  }

  @Delete('banners/:id')
  deleteBanner(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.deleteBanner(userId, id);
  }

  // Danh mục ẩm thực
  @Get('cuisines')
  listCuisines() {
    return this.content.listCuisines();
  }

  @Post('cuisines')
  createCuisine(@CurrentUser('id') userId: string, @Body() dto: CreateCuisineDto) {
    return this.content.createCuisine(userId, dto);
  }

  @Post('cuisines/reorder')
  reorderCuisines(@CurrentUser('id') userId: string, @Body() dto: ReorderDto) {
    return this.content.reorderCuisines(userId, dto.ids);
  }

  @Patch('cuisines/:id')
  updateCuisine(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCuisineDto) {
    return this.content.updateCuisine(userId, id, dto);
  }

  @Delete('cuisines/:id')
  deleteCuisine(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.deleteCuisine(userId, id);
  }
}
