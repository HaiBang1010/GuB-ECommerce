import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OptionalSupabaseAuthGuard } from '../iam/auth/optional-supabase-auth.guard';
import { CurrentCartOwner } from './cart-owner.decorator';
import { CartOwner, CartService, CartView } from './cart.service';
import { CartViewDto } from './dto/cart-response.dto';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

// Cart for guests AND signed-in users. OptionalSupabaseAuthGuard authenticates a
// Bearer token if present; otherwise the request is treated as a guest and the
// owner is resolved from the X-Cart-Session header (see CurrentCartOwner).
@ApiTags('cart')
@ApiBearerAuth()
@ApiBadRequestResponse({
  description: 'Missing X-Cart-Session header (guest) or invalid body.',
})
@UseGuards(OptionalSupabaseAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({
    summary: 'Get the cart',
    description:
      'Works without auth for guests — send an X-Cart-Session header instead of a Bearer token.',
  })
  @ApiOkResponse({ type: CartViewDto })
  @Get()
  get(@CurrentCartOwner() owner: CartOwner): Promise<CartView> {
    return this.cartService.getView(owner);
  }

  @ApiOperation({
    summary: 'Add an item to the cart',
    description:
      'Works without auth for guests — send an X-Cart-Session header instead of a Bearer token.',
  })
  @ApiOkResponse({ type: CartViewDto })
  @Post('items')
  @HttpCode(HttpStatus.OK)
  add(
    @CurrentCartOwner() owner: CartOwner,
    @Body() dto: AddCartItemDto,
  ): Promise<CartView> {
    return this.cartService.addItem(owner, dto.variantId, dto.quantity);
  }

  @ApiOperation({ summary: 'Set an item quantity' })
  @ApiOkResponse({ type: CartViewDto })
  @ApiNotFoundResponse({ description: 'Item is not in the cart.' })
  @Patch('items/:variantId')
  update(
    @CurrentCartOwner() owner: CartOwner,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartView> {
    return this.cartService.updateItem(owner, variantId, dto.quantity);
  }

  @ApiOperation({ summary: 'Remove an item from the cart' })
  @ApiOkResponse({ type: CartViewDto })
  @Delete('items/:variantId')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentCartOwner() owner: CartOwner,
    @Param('variantId') variantId: string,
  ): Promise<CartView> {
    return this.cartService.removeItem(owner, variantId);
  }

  @ApiOperation({ summary: 'Clear the cart' })
  @ApiOkResponse({ type: CartViewDto })
  @Delete()
  @HttpCode(HttpStatus.OK)
  clear(@CurrentCartOwner() owner: CartOwner): Promise<CartView> {
    return this.cartService.clear(owner);
  }
}
