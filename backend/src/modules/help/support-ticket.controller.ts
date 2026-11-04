import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateSupportTicketDto,
  CreateTicketMessageDto,
  ListTicketsQueryDto,
  SubmitCsatDto,
  UpdateTicketStatusDto,
} from './dto/support-ticket.dto';
import { CompensateTicketDto } from '../vouchers/dto/vouchers.dto';
import { SupportTicketService } from './support-ticket.service';

@Controller('help/tickets')
export class SupportTicketController {
  constructor(private readonly ticketService: SupportTicketService) {}

  // =========================================================================
  //  CUSTOMER TICKET APIs (ĐỢT B)
  // =========================================================================

  @Post()
  createTicket(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.ticketService.createTicket(user.id, dto);
  }

  @Get()
  getMyTickets(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTicketsQueryDto,
  ) {
    return this.ticketService.getMyTickets(user.id, query);
  }

  @Get('open-count')
  countOpenTickets(@CurrentUser() user: AuthUser) {
    return this.ticketService.countOpenTickets(user.id).then((count) => ({ count }));
  }

  @Get(':id')
  getTicketDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketService.getTicketDetail(user.id, user.role, id);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.ticketService.addMessage(user.id, user.role, id, dto);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolveTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketService.resolveTicket(user.id, user.role, id);
  }

  @Post(':id/csat')
  @HttpCode(HttpStatus.OK)
  submitCsat(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitCsatDto,
  ) {
    return this.ticketService.submitCsat(user.id, id, dto);
  }
}

@Controller('admin/help')
@Roles(Role.ADMIN)
export class AdminSupportController {
  constructor(private readonly ticketService: SupportTicketService) {}

  @Get('tickets')
  adminListTickets(@Query() query: ListTicketsQueryDto & { q?: string }) {
    return this.ticketService.adminListTickets(query);
  }

  @Get('tickets/:id')
  adminGetTicketDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.ticketService.getTicketDetail(admin.id, Role.ADMIN, id);
  }

  @Post('tickets/:id/messages')
  adminAddMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.ticketService.addMessage(admin.id, Role.ADMIN, id, dto);
  }

  @Patch('tickets/:id/status')
  adminUpdateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.ticketService.adminUpdateTicketStatus(id, admin.id, dto);
  }

  /** Tặng voucher bồi thường cho khách của phiếu (ghi AuditLog) */
  @Post('tickets/:id/compensate')
  compensate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CompensateTicketDto,
  ) {
    return this.ticketService.adminCompensate(id, user.id, dto);
  }

  @Get('stats')
  adminGetStats() {
    return this.ticketService.getAdminSupportStats();
  }
}

