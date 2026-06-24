import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

// Body for the secured release-expired job. `minutes` overrides the default TTL
// (mostly for testing); omitted → the service default applies.
export class ReleaseExpiredDto {
  @ApiPropertyOptional({
    example: 15,
    description: 'Override the TTL in minutes; omit to use the service default.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  minutes?: number;
}
