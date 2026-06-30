import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
import { OrderAdminResponseDto } from '../order/dto/order-admin-response.dto';
import { OrderAdminWithCustomer } from '../order/order.service';
import { PaymentService } from './payment.service';

/**
 * Admin refund route. Sits under `admin/orders` beside the order module's admin
 * routes (RESTful + consistent for the frontend), but is declared in the PAYMENT
 * module because the refund needs Stripe and OrderModule must not import
 * PaymentModule (that edge already exists the other way → a cycle). Same guard
 * stack as OrderAdminController: Supabase JWT + ADMIN role, backend-enforced.
 */
@ApiTags('order')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@ApiForbiddenResponse({ description: 'Requires ADMIN role.' })
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/orders')
export class PaymentAdminController {
  constructor(private readonly payment: PaymentService) {}

  @ApiOperation({
    summary:
      'Full-refund a paid/processing/shipped order (Stripe refund + stock release)',
  })
  @ApiOkResponse({ type: OrderAdminResponseDto })
  @ApiConflictResponse({
    description: 'Order is not in a refundable state, or has no captured payment.',
  })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  refund(@Param('id') id: string): Promise<OrderAdminWithCustomer> {
    return this.payment.refundOrder(id);
  }
}
