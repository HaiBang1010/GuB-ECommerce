import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../../../prisma/prisma.service';
import { CategoryService } from '../category/category.service';
import { ProductService } from './product.service';

// Integration spec: the accent/typo matching lives in Postgres (tsquery + pg_trgm),
// so a mock proves nothing — this runs the real `searchActive` against the local DB
// (docker compose `gub-db`). The unit-level orchestration is in product.service.spec.ts.
//
// jest does not load .env (no dotenv in this repo), so resolve DATABASE_URL from
// backend/.env ourselves before constructing PrismaClient.
function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;
  const envPath = resolve(__dirname, '../../../../.env');
  const text = readFileSync(envPath, 'utf8');
  const match = text.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m);
  if (match) process.env.DATABASE_URL = match[1];
}

// All fixture rows share this id/slug prefix so cleanup is exact and collision-free.
const PFX = 'zzs-';

describe('ProductService search (integration, real DB)', () => {
  let prisma: PrismaService;
  let service: ProductService;

  const cleanup = async (): Promise<void> => {
    await prisma.product.deleteMany({ where: { id: { startsWith: PFX } } });
    await prisma.category.deleteMany({ where: { id: { startsWith: PFX } } });
  };

  beforeAll(async () => {
    ensureDatabaseUrl();
    prisma = new PrismaService();
    service = new ProductService(prisma, new CategoryService(prisma));

    await cleanup(); // drop leftovers from a previously failed run
    await prisma.category.createMany({
      data: [
        { id: `${PFX}cat-vis`, nameVi: 'Áo', nameEn: 'Tops', slug: `${PFX}cat-vis` },
        {
          id: `${PFX}cat-arch`,
          nameVi: 'Cũ',
          nameEn: 'Archived',
          slug: `${PFX}cat-arch`,
          archivedAt: new Date(),
        },
      ],
    });
    await prisma.product.createMany({
      data: [
        {
          id: `${PFX}p1`,
          categoryId: `${PFX}cat-vis`,
          nameVi: 'Áo thun nam basic',
          nameEn: 'Men Basic T-Shirt',
          slug: `${PFX}p1`,
          basePriceCents: 19900,
        },
        {
          id: `${PFX}p2`,
          categoryId: `${PFX}cat-vis`,
          nameVi: 'Áo sơ mi trắng',
          nameEn: 'White Dress Shirt',
          slug: `${PFX}p2`,
          basePriceCents: 39900,
        },
        {
          // Name overlaps the queries below ("áo thun") on purpose: it would rank
          // high — but its category is archived, so it must never surface.
          id: `${PFX}p3`,
          categoryId: `${PFX}cat-arch`,
          nameVi: 'Áo thun đặc biệt',
          nameEn: 'Special T-Shirt',
          slug: `${PFX}p3`,
          basePriceCents: 9900,
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('matches an accented query "áo" (full-text), hiding archived-category rows', async () => {
    const ids = (await service.searchActive('áo')).map((p) => p.id);
    expect(ids).toContain(`${PFX}p1`);
    expect(ids).toContain(`${PFX}p2`);
    expect(ids).not.toContain(`${PFX}p3`);
  });

  it('matches an UNACCENTED query "ao thun" → finds "Áo thun…" (accent-insensitive)', async () => {
    const ids = (await service.searchActive('ao thun')).map((p) => p.id);
    expect(ids).toContain(`${PFX}p1`);
  });

  it('tolerates a typo via pg_trgm fuzzy fallback ("ao thun nam basc")', async () => {
    // "basc" is not a lexeme → the tsquery misses; only the trigram path can match.
    const ids = (await service.searchActive('ao thun nam basc')).map((p) => p.id);
    expect(ids).toContain(`${PFX}p1`);
  });

  it('never returns a product whose category is archived, even on a strong match', async () => {
    const ids = (await service.searchActive('ao thun')).map((p) => p.id);
    expect(ids).toContain(`${PFX}p1`); // search works...
    expect(ids).not.toContain(`${PFX}p3`); // ...but the archived-category row is hidden
  });
});
