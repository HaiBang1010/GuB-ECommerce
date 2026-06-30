import { ApiProperty } from '@nestjs/swagger';

// Summary of a birthday-voucher cron run. `total` = users with a birthday today;
// `granted` newly received the voucher; `skipped` already had it (a re-run, or a
// per-user failure). granted + skipped === total.
export class GrantBirthdayResultDto {
  @ApiProperty({
    example: 2,
    description: 'How many users newly received the birthday voucher.',
  })
  granted!: number;

  @ApiProperty({
    example: 1,
    description:
      'How many were skipped — already granted this year (idempotent) or a per-user failure.',
  })
  skipped!: number;

  @ApiProperty({
    example: 3,
    description: 'How many users have a birthday today (granted + skipped).',
  })
  total!: number;
}
