import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { CartService, CartView } from './cart.service';
import { GuestSession } from './guest-session.decorator';

// Merge requires a REAL session (SupabaseAuthGuard, not the optional guard used
// by the rest of the cart): only a signed-in user can fold a guest cart into
// their account. The guest session id comes from the X-Cart-Session header.
@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('cart')
export class CartMergeController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({
    summary: 'Merge a guest cart into the user cart on login',
    description: 'Requires a Bearer token; guest cart id comes from X-Cart-Session.',
  })
  @Post('merge')
  @HttpCode(HttpStatus.OK)
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @GuestSession() sessionId: string,
  ): Promise<CartView> {
    return this.cartService.mergeGuestIntoUser(user.id, sessionId);
  }
}
