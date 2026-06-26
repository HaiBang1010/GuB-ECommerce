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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { PaginatedOrdersResponseDto } from './dto/order-admin-response.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  OrderService,
  OrderWithDetail,
  PaginatedAdminOrders,
} from './order.service';

// Admin order management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('order')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@ApiForbiddenResponse({ description: 'Requires ADMIN role.' })
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/orders')
export class OrderAdminController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({
    summary:
      'List orders, paginated (multi ?status, ?search, ?page, ?pageSize) + customer info',
  })
  @ApiOkResponse({ type: PaginatedOrdersResponseDto })
  @Get()
  list(@Query() query: ListOrdersQueryDto): Promise<PaginatedAdminOrders> {
    return this.orderService.listForAdmin({
      statuses: query.status,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @ApiOperation({ summary: 'Get an order by id' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @Get(':id')
  getOne(@Param('id') id: string): Promise<OrderWithDetail> {
    return this.orderService.getForAdmin(id);
  }

  @ApiOperation({ summary: 'Advance fulfillment status (PAID->...->DELIVERED)' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ description: 'Illegal status transition.' })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderWithDetail> {
    return this.orderService.updateStatus(id, dto.status, dto.note);
  }
}
