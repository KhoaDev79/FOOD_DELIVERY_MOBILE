import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ArticleFeedbackDto,
  CreateHelpArticleDto,
  CreateHelpCategoryDto,
  ListHelpArticlesQueryDto,
  ListHelpCategoriesQueryDto,
  UpdateHelpArticleDto,
  UpdateHelpCategoryDto,
} from './dto/help.dto';
import { HelpService } from './help.service';

@Controller('help')
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  // =========================================================================
  //  PUBLIC / KHÁCH HÀNG
  // =========================================================================

  @Public()
  @Get('categories')
  getCategories(@Query() query: ListHelpCategoriesQueryDto) {
    return this.helpService.getCategories(query);
  }

  @Public()
  @Get('articles')
  getArticles(@Query() query: ListHelpArticlesQueryDto) {
    return this.helpService.getArticles(query);
  }

  @Public()
  @Get('articles/popular')
  getPopularArticles() {
    return this.helpService.getPopularArticles(5);
  }

  @Public()
  @Get('articles/:id')
  getArticleById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.helpService.getArticleById(id, user?.id);
  }

  @Post('articles/:id/feedback')
  @HttpCode(HttpStatus.OK)
  recordFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ArticleFeedbackDto,
  ) {
    return this.helpService.recordFeedback(id, user.id, dto);
  }

  // =========================================================================
  //  ADMIN APIs
  // =========================================================================

  @Get('admin/categories')
  @Roles(Role.ADMIN)
  adminListCategories() {
    return this.helpService.adminListCategories();
  }

  @Post('admin/categories')
  @Roles(Role.ADMIN)
  adminCreateCategory(
    @CurrentUser() admin: AuthUser,
    @Body() dto: CreateHelpCategoryDto,
  ) {
    return this.helpService.adminCreateCategory(dto, admin.id);
  }

  @Put('admin/categories/:id')
  @Roles(Role.ADMIN)
  adminUpdateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
    @Body() dto: UpdateHelpCategoryDto,
  ) {
    return this.helpService.adminUpdateCategory(id, dto, admin.id);
  }

  @Delete('admin/categories/:id')
  @Roles(Role.ADMIN)
  adminDeleteCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.helpService.adminDeleteCategory(id, admin.id);
  }

  @Get('admin/articles')
  @Roles(Role.ADMIN)
  adminListArticles(@Query('categoryId') categoryId?: string) {
    return this.helpService.adminListArticles(categoryId);
  }

  @Post('admin/articles')
  @Roles(Role.ADMIN)
  adminCreateArticle(
    @CurrentUser() admin: AuthUser,
    @Body() dto: CreateHelpArticleDto,
  ) {
    return this.helpService.adminCreateArticle(dto, admin.id);
  }

  @Put('admin/articles/:id')
  @Roles(Role.ADMIN)
  adminUpdateArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
    @Body() dto: UpdateHelpArticleDto,
  ) {
    return this.helpService.adminUpdateArticle(id, dto, admin.id);
  }

  @Delete('admin/articles/:id')
  @Roles(Role.ADMIN)
  adminDeleteArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.helpService.adminDeleteArticle(id, admin.id);
  }
}
