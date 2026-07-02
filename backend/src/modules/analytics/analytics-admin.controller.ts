import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import {
  AnalyticsService,
  AnalyticsSummary,
  TopProduct,
  TopSpender,
} from './analytics.service';
import { AnalyticsRangeQueryDto } from './dto/analytics-range-query.dto';
import { AnalyticsSummaryResponseDto } from './dto/analytics-summary-response.dto';
import { TopSpenderDto } from './dto/top-spenders-response.dto';
import { TopProductDto } from './dto/top-products-response.dto';

const DEFAULT_LIMIT = 10;

// Admin analytics dashboard — Supabase JWT + ADMIN role (backend-enforced, not
// UI-only). Read-only aggregations; no mutation surface.
@ApiTags('analytics')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@ApiForbiddenResponse({ description: 'Requires ADMIN role.' })
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/analytics')
export class AnalyticsAdminController {
  constructor(private readonly analytics: AnalyticsService) {}

  @ApiOperation({
    summary:
      'Dashboard summary: KPIs + revenue/new-users time series + orders-by-status (?from&to)',
  })
  @ApiOkResponse({ type: AnalyticsSummaryResponseDto })
  @Get('summary')
  summary(@Query() query: AnalyticsRangeQueryDto): Promise<AnalyticsSummary> {
    return this.analytics.getSummary(query.range());
  }

  @ApiOperation({ summary: 'Top spenders by net paid total (?from&to&limit)' })
  @ApiOkResponse({ type: [TopSpenderDto] })
  @Get('top-spenders')
  topSpenders(@Query() query: AnalyticsRangeQueryDto): Promise<TopSpender[]> {
    return this.analytics.getTopSpenders(query.range(), query.limit ?? DEFAULT_LIMIT);
  }

  @ApiOperation({ summary: 'Best-selling products by revenue (?from&to&limit)' })
  @ApiOkResponse({ type: [TopProductDto] })
  @Get('top-products')
  topProducts(@Query() query: AnalyticsRangeQueryDto): Promise<TopProduct[]> {
    return this.analytics.getTopProducts(query.range(), query.limit ?? DEFAULT_LIMIT);
  }
}
