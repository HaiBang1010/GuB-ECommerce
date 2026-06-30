import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { GrantBirthdayResultDto } from './dto/grant-birthday-result.dto';
import { VoucherService } from './voucher.service';

/**
 * Machine-triggered voucher jobs (no Supabase session). Guarded by the secret-header
 * AdminGuard (x-admin-secret), like OrderJobsController — NOT the human RoleGuard. An
 * external scheduler (UptimeRobot) calls POST /admin/jobs/grant-birthday-vouchers once
 * a day to drop the year's birthday voucher into the wallet of every user whose
 * birthday is today (Neon has no pg_cron; see ARCHITECTURE §6). Idempotent.
 */
@ApiTags('jobs')
@ApiSecurity('admin-secret')
@ApiUnauthorizedResponse({ description: 'Missing or invalid x-admin-secret header.' })
@UseGuards(AdminGuard)
@Controller('admin/jobs')
export class VoucherJobsController {
  constructor(private readonly vouchers: VoucherService) {}

  @ApiOperation({
    summary: "Grant the year's birthday voucher to today's birthday users (cron)",
  })
  @ApiOkResponse({ type: GrantBirthdayResultDto })
  @Post('grant-birthday-vouchers')
  @HttpCode(HttpStatus.OK)
  grantBirthday(): Promise<GrantBirthdayResultDto> {
    return this.vouchers.grantBirthdayVouchers();
  }
}
