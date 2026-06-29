import { ApiProperty } from '@nestjs/swagger';

// Why there is (or isn't) a suggestion — the FE renders a different affordance per
// status (suggested size · "enter your measurements" · nothing).
export type SizeSuggestionStatus =
  | 'SUGGESTED'
  | 'NO_PROFILE' // category has a chart but the user hasn't entered the needed measurement
  | 'NO_CHART' // the product's category has no size system
  | 'NO_MATCH'; // measurement is outside every range, or the matched size isn't offered

// How the matched size sits within its range.
export type SizeFit = 'SNUG' | 'PERFECT' | 'LOOSE';

export class SizeSuggestionResponseDto {
  @ApiProperty({
    enum: ['SUGGESTED', 'NO_PROFILE', 'NO_CHART', 'NO_MATCH'],
    example: 'SUGGESTED',
  })
  status!: SizeSuggestionStatus;

  @ApiProperty({ type: String, nullable: true, example: 'M' })
  suggestedSize!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'CHEST',
    description: 'Which body measurement drove the suggestion / is needed.',
  })
  measure!: string | null;

  @ApiProperty({
    enum: ['SNUG', 'PERFECT', 'LOOSE'],
    nullable: true,
    example: 'PERFECT',
  })
  fit!: SizeFit | null;
}
