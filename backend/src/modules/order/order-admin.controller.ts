import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderService, OrderWithDetail } from './order.service';

// Admin order management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('order')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/orders')
export class OrderAdminController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  list(@Query() query: ListOrdersQueryDto): Promise<OrderWithDetail[]> {
    return this.orderService.listForAdmin(query.status);
  }

  @Get(':id')
  getOne(@Param('id') id: string): Promise<OrderWithDetail> {
    return this.orderService.getForAdmin(id);
  }

  @ApiOperation({ summary: 'Advance fulfillment status (PAID->...->DELIVERED)' })
  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderWithDetail> {
    return this.orderService.updateStatus(id, dto.status, dto.note);
  }
}
