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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderService, OrderWithDetail } from './order.service';

// A signed-in user's own orders. Authentication only; every action is scoped to
// the caller's userId in the service.
@ApiTags('order')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@UseGuards(SupabaseAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'Place an order from the cart' })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ description: 'Cart is empty or items unavailable.' })
  @ApiNotFoundResponse({ description: 'Address not found.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderWithDetail> {
    return this.orderService.createFromCart(user.id, dto.addressId);
  }

  @ApiOperation({ summary: "List the current user's orders" })
  @ApiOkResponse({ type: [OrderResponseDto] })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<OrderWithDetail[]> {
    return this.orderService.listForUser(user.id);
  }

  @ApiOperation({ summary: 'Get one of the user\'s orders' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @Get(':id')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OrderWithDetail> {
    return this.orderService.getForUser(user.id, id);
  }

  @ApiOperation({ summary: 'Cancel an unpaid order (releases stock)' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ description: 'Only an unpaid order can be cancelled.' })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OrderWithDetail> {
    return this.orderService.cancel(user.id, id);
  }
}
