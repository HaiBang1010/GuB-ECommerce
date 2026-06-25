import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { Review, Role } from '@prisma/client';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { AdminReplyDto } from './dto/admin-reply.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { ReviewService } from './review.service';

// Admin review management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('review')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@ApiForbiddenResponse({ description: 'Requires ADMIN role.' })
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/reviews')
export class ReviewAdminController {
  constructor(private readonly reviewService: ReviewService) {}

  @ApiOperation({ summary: "Reply to a customer's review" })
  @ApiOkResponse({ type: ReviewResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiNotFoundResponse({ description: 'Review not found.' })
  @Post(':id/reply')
  @HttpCode(HttpStatus.OK)
  reply(@Param('id') id: string, @Body() dto: AdminReplyDto): Promise<Review> {
    return this.reviewService.reply(id, dto);
  }
}
