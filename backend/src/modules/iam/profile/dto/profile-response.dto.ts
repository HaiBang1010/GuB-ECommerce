import { ApiProperty } from '@nestjs/swagger';

// The caller's own body profile. All optional — a user who never filled it in has
// nulls. `measurements` is a free-form JSON object (e.g. { chest, waist, hip,
// footLength }). Mirrors the admin ProfileDto so the FE type lines up.
export class ProfileResponseDto {
  @ApiProperty({ type: Number, nullable: true, example: 175 })
  heightCm!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 68 })
  weightKg!: number | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { chest: 96, waist: 80, hip: 98, footLength: 26.5 },
  })
  measurements!: Record<string, unknown> | null;

  // Stored on iam.User; surfaced here so the profile form can read/write it.
  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date',
    example: '1995-06-15',
  })
  birthday!: Date | null;
}
