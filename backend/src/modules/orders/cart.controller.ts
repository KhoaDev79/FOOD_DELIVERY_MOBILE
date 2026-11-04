import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CartCheckService } from './cart-check.service';
import { CartCheckDto } from './dto/orders.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartCheck: CartCheckService) {}

  /**
   * Kiểm tra giỏ hàng: món hết / ngoài giờ bán / đổi giá / bị xoá, quán còn nhận đơn không.
   * Công khai vì khách chưa đăng nhập cũng có giỏ.
   */
  @Public()
  @Post('check')
  @HttpCode(HttpStatus.OK)
  check(@Body() dto: CartCheckDto) {
    return this.cartCheck.check(dto.restaurantId, dto.items);
  }
}
