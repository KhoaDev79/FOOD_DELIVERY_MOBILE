import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { HideReviewImageDto, ReplyReviewDto, UnhideReviewImageDto } from './dto/restaurants.dto';
import { RestaurantsService } from './restaurants.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly restaurants: RestaurantsService) {}

  /** POST /reviews/:id/reply – Chủ quán trả lời đánh giá của khách (chỉ 1 lần, E3). */
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Post(':id/reply')
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.restaurants.replyToReview(id, user, dto.reply);
  }

  /** POST /reviews/:id/images/hide – ẩn ảnh không phù hợp (bắt buộc lý do, ghi nhật ký) */
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Post(':id/images/hide')
  hideImage(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: HideReviewImageDto) {
    return this.restaurants.setReviewImageHidden(id, user, dto.imageUrl, true, dto.reason);
  }

  /** POST /reviews/:id/images/unhide – hiện lại ảnh đã ẩn */
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  @Post(':id/images/unhide')
  unhideImage(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: UnhideReviewImageDto) {
    return this.restaurants.setReviewImageHidden(id, user, dto.imageUrl, false);
  }
}

