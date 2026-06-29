import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// Body measurements (cm). All optional — a user fills in only what's relevant to the
// products they buy. Used by the rule-based size suggestion (product/size). Keys are
// stable so the suggestion can read the right one per size system.
export class MeasurementsDto {
  @ApiPropertyOptional({ example: 96, description: 'Chest circumference (cm).' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(300)
  chest?: number;

  @ApiPropertyOptional({ example: 80, description: 'Waist circumference (cm).' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(300)
  waist?: number;

  @ApiPropertyOptional({ example: 98, description: 'Hip circumference (cm).' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(300)
  hip?: number;

  @ApiPropertyOptional({ example: 26.5, description: 'Foot length (cm).' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(60)
  footLength?: number;
}

// No PartialType (@nestjs/mapped-types is not installed) → fields are spelled out.
// Every field optional; the service writes only the ones provided.
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 175, description: 'Height (cm).' })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(272)
  heightCm?: number;

  @ApiPropertyOptional({ example: 68, description: 'Weight (kg).' })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(400)
  weightKg?: number;

  @ApiPropertyOptional({ type: MeasurementsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MeasurementsDto)
  measurements?: MeasurementsDto;
}
