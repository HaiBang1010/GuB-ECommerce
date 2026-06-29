import { Injectable } from '@nestjs/common';
import { ProfileService } from '../../iam/profile/profile.service';
import { CategoryService } from '../category/category.service';
import { ProductService } from '../product/product.service';
import { ProductVariantService } from '../variant/variant.service';
import {
  SizeFit,
  SizeSuggestionResponseDto,
} from './dto/size-suggestion-response.dto';
import { MEASURE_KEY, SIZE_CHARTS, SizeChartEntry } from './size-charts';

/**
 * Rule-based size suggestion (no ML — ARCHITECTURE §8). Composes in-process across
 * modules: product/variant/category (own module) + the user's measurements via the
 * global ProfileService (iam). No cross-schema JOIN — every read is a service call.
 */
@Injectable()
export class SizeSuggestionService {
  constructor(
    private readonly products: ProductService,
    private readonly variants: ProductVariantService,
    private readonly categories: CategoryService,
    private readonly profiles: ProfileService,
  ) {}

  async suggest(
    slug: string,
    userId: string,
  ): Promise<SizeSuggestionResponseDto> {
    // 404 if the product isn't visible (archived / under an archived category).
    const product = await this.products.getActiveBySlug(slug);

    const sizeSystem = await this.categories.getSizeSystem(product.categoryId);
    if (sizeSystem === null) return result('NO_CHART');

    const chart = SIZE_CHARTS[sizeSystem];
    const profile = await this.profiles.getByUserId(userId);
    const value = readMeasurement(
      profile?.measurements,
      MEASURE_KEY[chart.measure],
    );
    if (value === null) return result('NO_PROFILE', null, chart.measure);

    const entry = matchEntry(chart.entries, value);
    if (entry === null) return result('NO_MATCH', null, chart.measure);

    // Only ever suggest a size the product actually offers.
    const offered = new Set(
      (await this.variants.getActiveForProductSlug(slug)).map((v) => v.size),
    );
    if (!offered.has(entry.size)) return result('NO_MATCH', null, chart.measure);

    return result('SUGGESTED', entry.size, chart.measure, fitOf(entry, value));
  }
}

function result(
  status: SizeSuggestionResponseDto['status'],
  suggestedSize: string | null = null,
  measure: string | null = null,
  fit: SizeFit | null = null,
): SizeSuggestionResponseDto {
  return { status, suggestedSize, measure, fit };
}

// Read a positive numeric measurement from the free-form JSON, or null if absent.
function readMeasurement(measurements: unknown, key: string): number | null {
  if (measurements === null || typeof measurements !== 'object') return null;
  const value = (measurements as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

// First entry whose range contains the value. Ranges are half-open [min, max) so a
// shared boundary resolves to the LARGER size; the last entry is inclusive.
function matchEntry(
  entries: SizeChartEntry[],
  value: number,
): SizeChartEntry | null {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const isLast = i === entries.length - 1;
    const withinUpper = isLast ? value <= e.maxCm : value < e.maxCm;
    if (value >= e.minCm && withinUpper) return e;
  }
  return null;
}

// Where the value sits in the matched size's range: low end = roomy (LOOSE), high
// end = tight (SNUG), middle = PERFECT.
function fitOf(entry: SizeChartEntry, value: number): SizeFit {
  const span = entry.maxCm - entry.minCm;
  const pos = span > 0 ? (value - entry.minCm) / span : 0.5;
  if (pos < 1 / 3) return 'LOOSE';
  if (pos > 2 / 3) return 'SNUG';
  return 'PERFECT';
}
