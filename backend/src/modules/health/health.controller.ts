import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * Lightweight liveness probe — MUST NOT query the database.
   * UptimeRobot pings this every 5 min to keep the Render instance awake.
   */
  @ApiOperation({ summary: 'Liveness probe (does not hit the DB)' })
  @ApiOkResponse({ type: HealthResponseDto })
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
