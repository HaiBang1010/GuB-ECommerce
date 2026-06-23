import { IsInt, IsOptional, Min } from 'class-validator';

// Body for the secured release-expired job. `minutes` overrides the default TTL
// (mostly for testing); omitted → the service default applies.
export class ReleaseExpiredDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  minutes?: number;
}
