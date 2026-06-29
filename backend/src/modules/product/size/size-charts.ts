import { SizeSystem } from '@prisma/client';

// Standard size charts as CODE CONSTANTS — the rule-based size suggestion (no ML,
// ARCHITECTURE §8). Each SizeSystem declares which body measurement to match on and
// the size -> [minCm, maxCm] ranges. Sizes are strings that line up with the values
// admins type into `ProductVariant.size` ("S"/"M"/"L"/"XL", "39".."44"). Ranges are
// half-open [min, max) (the last entry is inclusive) so a shared boundary resolves to
// the larger size deterministically — see SizeSuggestionService.

export type BodyMeasure = 'CHEST' | 'WAIST' | 'HIP' | 'FOOT_LENGTH';

export interface SizeChartEntry {
  size: string;
  minCm: number;
  maxCm: number;
}

export interface SizeChart {
  measure: BodyMeasure;
  entries: SizeChartEntry[]; // ascending by range
}

export const SIZE_CHARTS: Record<SizeSystem, SizeChart> = {
  [SizeSystem.ALPHA_TOPS]: {
    measure: 'CHEST',
    entries: [
      { size: 'S', minCm: 86, maxCm: 94 },
      { size: 'M', minCm: 94, maxCm: 102 },
      { size: 'L', minCm: 102, maxCm: 110 },
      { size: 'XL', minCm: 110, maxCm: 118 },
    ],
  },
  [SizeSystem.ALPHA_BOTTOMS]: {
    measure: 'WAIST',
    entries: [
      { size: 'S', minCm: 68, maxCm: 76 },
      { size: 'M', minCm: 76, maxCm: 84 },
      { size: 'L', minCm: 84, maxCm: 92 },
      { size: 'XL', minCm: 92, maxCm: 100 },
    ],
  },
  [SizeSystem.EU_SHOES]: {
    measure: 'FOOT_LENGTH',
    entries: [
      { size: '39', minCm: 24.5, maxCm: 25.0 },
      { size: '40', minCm: 25.0, maxCm: 25.5 },
      { size: '41', minCm: 25.5, maxCm: 26.0 },
      { size: '42', minCm: 26.0, maxCm: 26.5 },
      { size: '43', minCm: 26.5, maxCm: 27.0 },
      { size: '44', minCm: 27.0, maxCm: 27.5 },
    ],
  },
};

// The Profile.measurements JSON key each measure reads from.
export const MEASURE_KEY: Record<BodyMeasure, string> = {
  CHEST: 'chest',
  WAIST: 'waist',
  HIP: 'hip',
  FOOT_LENGTH: 'footLength',
};
