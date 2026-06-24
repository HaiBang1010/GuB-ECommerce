import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * Lightweight liveness probe — MUST NOT query the database.
   * UptimeRobot pings this every 5 min to keep the Render instance awake.
   */
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
