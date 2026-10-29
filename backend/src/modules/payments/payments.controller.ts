import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CreatePaymentUrlDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('vnpay/:orderId/url')
  createUrl(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: CreatePaymentUrlDto,
  ) {
    return this.payments.createVnpayUrl(orderId, user, req, dto);
  }

  @Public()
  @Get('vnpay/ipn')
  async handleIpn(@Query() query: Record<string, unknown>) {
    return this.payments.handleIpn(query);
  }

  @Public()
  @Get('vnpay/return')
  handleReturn(@Query() query: Record<string, unknown>, @Res() res: Response) {
    const { redirectUrl } = this.payments.handleReturn(query);
    return res.redirect(redirectUrl);
  }
}

