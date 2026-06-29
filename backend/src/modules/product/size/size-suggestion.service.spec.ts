import { CategoryService } from '../category/category.service';
import { ProductService } from '../product/product.service';
import { ProductVariantService } from '../variant/variant.service';
import { ProfileService } from '../../iam/profile/profile.service';
import { SizeSuggestionService } from './size-suggestion.service';

// Collaborators are mocked as plain `{ method: jest.fn() }` objects and passed into
// the constructor (the admin-user.service.spec convention). The rule logic + chart
// constants are exercised directly.
describe('SizeSuggestionService', () => {
  let products: { getActiveBySlug: jest.Mock };
  let variants: { getActiveForProductSlug: jest.Mock };
  let categories: { getSizeSystem: jest.Mock };
  let profiles: { getByUserId: jest.Mock };
  let service: SizeSuggestionService;

  const slug = 'tee';
  const userId = 'user-1';

  beforeEach(() => {
    products = { getActiveBySlug: jest.fn() };
    variants = { getActiveForProductSlug: jest.fn() };
    categories = { getSizeSystem: jest.fn() };
    profiles = { getByUserId: jest.fn() };
    service = new SizeSuggestionService(
      products as unknown as ProductService,
      variants as unknown as ProductVariantService,
      categories as unknown as CategoryService,
      profiles as unknown as ProfileService,
    );
    products.getActiveBySlug.mockResolvedValue({ id: 'prod-1', categoryId: 'cat-1' });
  });

  it('NO_CHART when the category has no size system', async () => {
    categories.getSizeSystem.mockResolvedValue(null);

    await expect(service.suggest(slug, userId)).resolves.toEqual({
      status: 'NO_CHART',
      suggestedSize: null,
      measure: null,
      fit: null,
    });
    expect(profiles.getByUserId).not.toHaveBeenCalled();
  });

  it('NO_PROFILE when the needed measurement is missing', async () => {
    categories.getSizeSystem.mockResolvedValue('ALPHA_TOPS');
    profiles.getByUserId.mockResolvedValue({ measurements: { waist: 80 } });

    await expect(service.suggest(slug, userId)).resolves.toEqual({
      status: 'NO_PROFILE',
      suggestedSize: null,
      measure: 'CHEST',
      fit: null,
    });
  });

  it('SUGGESTED clothing size from CHEST (matched + offered)', async () => {
    categories.getSizeSystem.mockResolvedValue('ALPHA_TOPS');
    profiles.getByUserId.mockResolvedValue({ measurements: { chest: 98 } });
    variants.getActiveForProductSlug.mockResolvedValue([
      { size: 'S' },
      { size: 'M' },
      { size: 'L' },
    ]);

    // chest 98 ∈ M [94,102); midpoint-ish → PERFECT.
    await expect(service.suggest(slug, userId)).resolves.toEqual({
      status: 'SUGGESTED',
      suggestedSize: 'M',
      measure: 'CHEST',
      fit: 'PERFECT',
    });
  });

  it('SUGGESTED shoe size from FOOT_LENGTH', async () => {
    categories.getSizeSystem.mockResolvedValue('EU_SHOES');
    profiles.getByUserId.mockResolvedValue({ measurements: { footLength: 26.2 } });
    variants.getActiveForProductSlug.mockResolvedValue([
      { size: '41' },
      { size: '42' },
      { size: '43' },
    ]);

    // footLength 26.2 ∈ 42 [26.0,26.5).
    await expect(service.suggest(slug, userId)).resolves.toMatchObject({
      status: 'SUGGESTED',
      suggestedSize: '42',
      measure: 'FOOT_LENGTH',
    });
  });

  it('NO_MATCH when the value is outside every range', async () => {
    categories.getSizeSystem.mockResolvedValue('ALPHA_TOPS');
    profiles.getByUserId.mockResolvedValue({ measurements: { chest: 200 } });

    await expect(service.suggest(slug, userId)).resolves.toEqual({
      status: 'NO_MATCH',
      suggestedSize: null,
      measure: 'CHEST',
      fit: null,
    });
    expect(variants.getActiveForProductSlug).not.toHaveBeenCalled();
  });

  it('NO_MATCH when the matched size is not offered by the product', async () => {
    categories.getSizeSystem.mockResolvedValue('ALPHA_TOPS');
    profiles.getByUserId.mockResolvedValue({ measurements: { chest: 98 } });
    variants.getActiveForProductSlug.mockResolvedValue([{ size: 'S' }]); // no M

    await expect(service.suggest(slug, userId)).resolves.toEqual({
      status: 'NO_MATCH',
      suggestedSize: null,
      measure: 'CHEST',
      fit: null,
    });
  });
});
