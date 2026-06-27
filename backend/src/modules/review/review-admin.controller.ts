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
import { Review, Role } from '@prisma/client';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { AdminReplyDto } from './dto/admin-reply.dto';
import { PaginatedAdminReviewsResponseDto } from './dto/admin-review-response.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { PaginatedAdminReviews, ReviewService } from './review.service';

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

  @ApiOperation({
    summary: 'List all reviews, paginated (?replied filter) + product/reviewer info',
  })
  @ApiOkResponse({ type: PaginatedAdminReviewsResponseDto })
  @Get()
  list(@Query() query: ListReviewsQueryDto): Promise<PaginatedAdminReviews> {
    return this.reviewService.listAllForAdmin({
      page: query.page,
      pageSize: query.pageSize,
      replied: query.replied,
    });
  }

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
