import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService, OrderWithDetail } from './order.service';

// A signed-in user's own orders. Authentication only; every action is scoped to
// the caller's userId in the service.
@ApiTags('order')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'Place an order from the cart' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderWithDetail> {
    return this.orderService.createFromCart(user.id, dto.addressId);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<OrderWithDetail[]> {
    return this.orderService.listForUser(user.id);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OrderWithDetail> {
    return this.orderService.getForUser(user.id, id);
  }

  @ApiOperation({ summary: 'Cancel an unpaid order (releases stock)' })
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OrderWithDetail> {
    return this.orderService.cancel(user.id, id);
  }
}
