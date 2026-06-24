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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalSupabaseAuthGuard } from '../iam/auth/optional-supabase-auth.guard';
import { CurrentCartOwner } from './cart-owner.decorator';
import { CartOwner, CartService, CartView } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

// Cart for guests AND signed-in users. OptionalSupabaseAuthGuard authenticates a
// Bearer token if present; otherwise the request is treated as a guest and the
// owner is resolved from the X-Cart-Session header (see CurrentCartOwner).
@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(OptionalSupabaseAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({
    summary: 'Get the cart',
    description:
      'Works without auth for guests — send an X-Cart-Session header instead of a Bearer token.',
  })
  @Get()
  get(@CurrentCartOwner() owner: CartOwner): Promise<CartView> {
    return this.cartService.getView(owner);
  }

  @ApiOperation({
    summary: 'Add an item to the cart',
    description:
      'Works without auth for guests — send an X-Cart-Session header instead of a Bearer token.',
  })
  @Post('items')
  @HttpCode(HttpStatus.OK)
  add(
    @CurrentCartOwner() owner: CartOwner,
    @Body() dto: AddCartItemDto,
  ): Promise<CartView> {
    return this.cartService.addItem(owner, dto.variantId, dto.quantity);
  }

  @Patch('items/:variantId')
  update(
    @CurrentCartOwner() owner: CartOwner,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartView> {
    return this.cartService.updateItem(owner, variantId, dto.quantity);
  }

  @Delete('items/:variantId')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentCartOwner() owner: CartOwner,
    @Param('variantId') variantId: string,
  ): Promise<CartView> {
    return this.cartService.removeItem(owner, variantId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  clear(@CurrentCartOwner() owner: CartOwner): Promise<CartView> {
    return this.cartService.clear(owner);
  }
}
