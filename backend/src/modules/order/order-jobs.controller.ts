import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ReleaseExpiredDto } from './dto/release-expired.dto';
import { OrderService } from './order.service';

/**
 * Machine-triggered maintenance jobs (no Supabase session). Guarded by the
 * secret-header AdminGuard. An external scheduler — UptimeRobot — calls
 * POST /admin/jobs/release-expired every few minutes to free stock held by
 * abandoned unpaid orders (Neon has no pg_cron; see ARCHITECTURE §6). Idempotent.
 */
@ApiTags('jobs')
@ApiSecurity('admin-secret')
@UseGuards(AdminGuard)
@Controller('admin/jobs')
export class OrderJobsController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({
    summary: 'Release stock of expired unpaid orders (UptimeRobot cron)',
  })
  @Post('release-expired')
  @HttpCode(HttpStatus.OK)
  releaseExpired(
    @Body() dto: ReleaseExpiredDto,
  ): Promise<{ released: number }> {
    return this.orderService.releaseExpired(dto.minutes);
  }
}
