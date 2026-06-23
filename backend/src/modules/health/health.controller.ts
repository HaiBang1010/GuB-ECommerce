import { Controller, Get } from '@nestjs/common';

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
