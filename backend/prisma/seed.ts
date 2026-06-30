// GuB demo seed — populates the catalog so every storefront/home section renders with
// real data (category grid, featured-collection carousels, on-sale + new-arrivals rows,
// image-bearing product grid) and /collections/[slug] + size suggestion are testable.
//
// Images are ONLINE PLACEHOLDERS (picsum.photos) — no Cloudinary, no upload.
// Money is integer cents. Does NOT touch the schema, auth, or migrations (data only).
//
// IDEMPOTENT: re-running upserts by unique key (slug / code) and, per product, replaces
// its own variants/images (deleteMany scoped to that productId → recreate), so there are
// no unique collisions and no duplicates. Reset = just run it again. No destructive DROP.
//
// Run: `npx prisma db seed` (from backend/, DB up via docker compose). See backend README.

import { PrismaClient, Prisma, SizeSystem, VoucherType } from '@prisma/client';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

// Deterministic placeholder URLs (stable per slug so re-runs don't churn images).
const cover = (slug: string) => `https://picsum.photos/seed/${slug}/800/600`;
const photo = (slug: string, i: number) =>
  `https://picsum.photos/seed/${slug}-${i}/600/600`;

const TOP_SIZES = ['S', 'M', 'L', 'XL']; // ALPHA_TOPS / ALPHA_BOTTOMS
const SHOE_SIZES = ['40', '41', '42', '43']; // EU_SHOES (all within the size chart)
const ONE_SIZE = ['One Size']; // accessories (no sizeSystem)

// --- Categories ---------------------------------------------------------------
// Top-level first (the storefront grid shows only parentId=null); two children under
// "ao" exercise the admin tree. sizeSystem drives the rule-based size suggestion.
type CatSeed = {
  slug: string;
  nameVi: string;
  nameEn: string;
  sizeSystem?: SizeSystem;
  parent?: string; // parent slug
};

const CATEGORIES: CatSeed[] = [
  { slug: 'ao', nameVi: 'Áo', nameEn: 'Tops', sizeSystem: SizeSystem.ALPHA_TOPS },
  { slug: 'quan', nameVi: 'Quần', nameEn: 'Bottoms', sizeSystem: SizeSystem.ALPHA_BOTTOMS },
  { slug: 'giay', nameVi: 'Giày', nameEn: 'Shoes', sizeSystem: SizeSystem.EU_SHOES },
  { slug: 'phu-kien', nameVi: 'Phụ kiện', nameEn: 'Accessories' },
  { slug: 'ao-thun', nameVi: 'Áo thun', nameEn: 'T-Shirts', sizeSystem: SizeSystem.ALPHA_TOPS, parent: 'ao' },
  { slug: 'ao-khoac', nameVi: 'Áo khoác', nameEn: 'Jackets', sizeSystem: SizeSystem.ALPHA_TOPS, parent: 'ao' },
];

// --- Collections --------------------------------------------------------------
type ColSeed = {
  slug: string;
  nameVi: string;
  nameEn: string;
  featuredOnHome: boolean;
  homeSortOrder: number;
};

const COLLECTIONS: ColSeed[] = [
  { slug: 'the-thao', nameVi: 'Thể thao', nameEn: 'Sportswear', featuredOnHome: true, homeSortOrder: 1 },
  { slug: 'mua-dong', nameVi: 'Mùa đông', nameEn: 'Winter', featuredOnHome: true, homeSortOrder: 2 },
  { slug: 'boi-loi', nameVi: 'Bơi lội', nameEn: 'Swimwear', featuredOnHome: false, homeSortOrder: 0 },
];

// --- Products -----------------------------------------------------------------
type ProductSeed = {
  slug: string;
  nameVi: string;
  nameEn: string;
  category: string; // category slug
  basePriceCents: number;
  salePriceCents?: number; // < base → shows in the on-sale row
  brand?: string;
  sizes: string[];
  colors: string[]; // 1–2 colors → variants = sizes × colors
  collections?: string[]; // collection slugs
};

const PRODUCTS: ProductSeed[] = [
  // Tops (category "ao")
  { slug: 'ao-polo-pique', nameVi: 'Áo polo piqué', nameEn: 'Piqué Polo', category: 'ao', basePriceCents: 3200, salePriceCents: 2400, brand: 'GuB Basics', sizes: TOP_SIZES, colors: ['Navy', 'White'], collections: ['the-thao'] },
  { slug: 'ao-so-mi-oxford', nameVi: 'Áo sơ mi Oxford', nameEn: 'Oxford Shirt', category: 'ao', basePriceCents: 4500, brand: 'GuB', sizes: TOP_SIZES, colors: ['White', 'Blue'] },
  { slug: 'ao-hoodie-ni', nameVi: 'Áo hoodie nỉ', nameEn: 'Fleece Hoodie', category: 'ao', basePriceCents: 5500, salePriceCents: 4675, brand: 'GuB Sport', sizes: TOP_SIZES, colors: ['Gray', 'Black'], collections: ['mua-dong', 'the-thao'] },
  // Tops (children)
  { slug: 'ao-thun-co-tron', nameVi: 'Áo thun cổ tròn', nameEn: 'Crewneck Tee', category: 'ao-thun', basePriceCents: 2500, salePriceCents: 1999, brand: 'GuB Basics', sizes: TOP_SIZES, colors: ['Black', 'White'], collections: ['the-thao'] },
  { slug: 'ao-khoac-bomber', nameVi: 'Áo khoác bomber', nameEn: 'Bomber Jacket', category: 'ao-khoac', basePriceCents: 7900, brand: 'GuB', sizes: TOP_SIZES, colors: ['Olive', 'Black'], collections: ['mua-dong'] },

  // Bottoms (category "quan")
  { slug: 'quan-jeans-slim', nameVi: 'Quần jeans slim', nameEn: 'Slim Jeans', category: 'quan', basePriceCents: 4900, salePriceCents: 3920, brand: 'GuB Denim', sizes: TOP_SIZES, colors: ['Indigo', 'Black'] },
  { slug: 'quan-kaki-chino', nameVi: 'Quần kaki chino', nameEn: 'Chino Pants', category: 'quan', basePriceCents: 4200, brand: 'GuB', sizes: TOP_SIZES, colors: ['Beige', 'Navy'] },
  { slug: 'quan-jogger-ni', nameVi: 'Quần jogger nỉ', nameEn: 'Fleece Joggers', category: 'quan', basePriceCents: 3800, brand: 'GuB Sport', sizes: TOP_SIZES, colors: ['Gray', 'Black'], collections: ['the-thao', 'mua-dong'] },
  { slug: 'quan-short-the-thao', nameVi: 'Quần short thể thao', nameEn: 'Sport Shorts', category: 'quan', basePriceCents: 2900, salePriceCents: 2320, brand: 'GuB Sport', sizes: TOP_SIZES, colors: ['Black', 'Red'], collections: ['the-thao'] },

  // Shoes (category "giay")
  { slug: 'giay-sneaker-classic', nameVi: 'Giày sneaker classic', nameEn: 'Classic Sneakers', category: 'giay', basePriceCents: 6500, brand: 'GuB Footwear', sizes: SHOE_SIZES, colors: ['White', 'Black'], collections: ['the-thao'] },
  { slug: 'giay-chay-bo', nameVi: 'Giày chạy bộ', nameEn: 'Running Shoes', category: 'giay', basePriceCents: 8900, salePriceCents: 7120, brand: 'GuB Sport', sizes: SHOE_SIZES, colors: ['Blue', 'Gray'], collections: ['the-thao'] },
  { slug: 'giay-boot-da', nameVi: 'Giày boot da', nameEn: 'Leather Boots', category: 'giay', basePriceCents: 12000, brand: 'GuB', sizes: SHOE_SIZES, colors: ['Brown', 'Black'], collections: ['mua-dong'] },
  { slug: 'giay-sandal', nameVi: 'Dép sandal', nameEn: 'Sandals', category: 'giay', basePriceCents: 2200, brand: 'GuB', sizes: SHOE_SIZES, colors: ['Black', 'Tan'], collections: ['boi-loi'] },

  // Accessories (category "phu-kien", no sizeSystem → One Size)
  { slug: 'non-luoi-trai', nameVi: 'Nón lưỡi trai', nameEn: 'Baseball Cap', category: 'phu-kien', basePriceCents: 1800, salePriceCents: 1440, brand: 'GuB', sizes: ONE_SIZE, colors: ['Black', 'Khaki'] },
  { slug: 'tui-deo-cheo', nameVi: 'Túi đeo chéo', nameEn: 'Crossbody Bag', category: 'phu-kien', basePriceCents: 3500, brand: 'GuB', sizes: ONE_SIZE, colors: ['Black', 'Brown'] },
  { slug: 'kinh-boi', nameVi: 'Kính bơi', nameEn: 'Swim Goggles', category: 'phu-kien', basePriceCents: 1500, brand: 'GuB Swim', sizes: ONE_SIZE, colors: ['Blue', 'Clear'], collections: ['boi-loi'] },
];

async function main(): Promise<void> {
  // Categories: parents first so children can resolve parentId.
  const catId = new Map<string, string>();
  for (const c of CATEGORIES.filter((x) => !x.parent)) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        nameVi: c.nameVi,
        nameEn: c.nameEn,
        imageUrl: cover(c.slug),
        sizeSystem: c.sizeSystem ?? null,
      },
      update: {
        nameVi: c.nameVi,
        nameEn: c.nameEn,
        imageUrl: cover(c.slug),
        sizeSystem: c.sizeSystem ?? null,
      },
    });
    catId.set(c.slug, row.id);
  }
  for (const c of CATEGORIES.filter((x) => x.parent)) {
    const parentId = catId.get(c.parent as string);
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        nameVi: c.nameVi,
        nameEn: c.nameEn,
        imageUrl: cover(c.slug),
        sizeSystem: c.sizeSystem ?? null,
        parentId,
      },
      update: {
        nameVi: c.nameVi,
        nameEn: c.nameEn,
        imageUrl: cover(c.slug),
        sizeSystem: c.sizeSystem ?? null,
        parentId,
      },
    });
    catId.set(c.slug, row.id);
  }

  // Collections.
  const colId = new Map<string, string>();
  for (const c of COLLECTIONS) {
    const row = await prisma.collection.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        nameVi: c.nameVi,
        nameEn: c.nameEn,
        imageUrl: cover(c.slug),
        featuredOnHome: c.featuredOnHome,
        homeSortOrder: c.homeSortOrder,
      },
      update: {
        nameVi: c.nameVi,
        nameEn: c.nameEn,
        imageUrl: cover(c.slug),
        featuredOnHome: c.featuredOnHome,
        homeSortOrder: c.homeSortOrder,
      },
    });
    colId.set(c.slug, row.id);
  }

  // Products + variants + images + collection membership.
  let variantCount = 0;
  let imageCount = 0;
  let membershipCount = 0;
  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    // Stagger createdAt so ?sort=new has a real order (index 0 = newest).
    const createdAt = new Date(now - i * DAY);
    const categoryId = catId.get(p.category);
    if (categoryId === undefined) {
      throw new Error(`Unknown category slug "${p.category}" for product "${p.slug}"`);
    }

    const fields = {
      nameVi: p.nameVi,
      nameEn: p.nameEn,
      descriptionVi: `${p.nameVi} – sản phẩm demo, chất liệu thoải mái.`,
      descriptionEn: `${p.nameEn} – demo product, comfortable material.`,
      brand: p.brand ?? null,
      categoryId,
      basePriceCents: p.basePriceCents,
      salePriceCents: p.salePriceCents ?? null,
      createdAt,
    };

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, ...fields },
      update: fields,
    });

    // Replace this product's variants + images (scoped — never touches other products).
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.deleteMany({ where: { productId: product.id } });

    const variants: Prisma.ProductVariantCreateManyInput[] = [];
    p.sizes.forEach((size, si) => {
      for (const color of p.colors) {
        variants.push({
          productId: product.id,
          sku: `DEMO-${p.slug}-${size}-${color}`.replace(/\s+/g, '-').toUpperCase(),
          size,
          color,
          priceCents: p.basePriceCents,
          stockQty: (si + 1) * 10, // always > 0 so the variant is buyable
        });
      }
    });
    await prisma.productVariant.createMany({ data: variants });
    variantCount += variants.length;

    // Generic (color=null) cover at position 0 → resolves as primaryImageUrl; then one
    // image per color.
    const images: Prisma.ProductImageCreateManyInput[] = [
      { productId: product.id, url: photo(p.slug, 0), publicId: `demo/${p.slug}/0`, color: null, position: 0 },
    ];
    p.colors.slice(0, 2).forEach((color, idx) => {
      images.push({
        productId: product.id,
        url: photo(p.slug, idx + 1),
        publicId: `demo/${p.slug}/${idx + 1}`,
        color,
        position: idx + 1,
      });
    });
    await prisma.productImage.createMany({ data: images });
    imageCount += images.length;

    if (p.collections?.length) {
      const data = p.collections
        .map((cs) => colId.get(cs))
        .filter((id): id is string => id !== undefined)
        .map((collectionId) => ({ productId: product.id, collectionId }));
      const res = await prisma.productCollection.createMany({ data, skipDuplicates: true });
      membershipCount += res.count;
    }
  }

  // Bonus: a couple of demo vouchers (upsert by code; no user grants since no users seeded).
  const vouchers: Prisma.VoucherCreateInput[] = [
    {
      code: 'SAVE10',
      titleVi: 'Giảm 10%',
      titleEn: '10% off',
      descriptionVi: 'Giảm 10% cho đơn từ $20, tối đa $50.',
      descriptionEn: '10% off orders over $20, up to $50.',
      type: VoucherType.PERCENT,
      isPublic: true,
      value: 10,
      minOrderCents: 2000,
      maxDiscountCents: 5000,
    },
    {
      code: 'BIRTHDAY-2026',
      titleVi: 'Quà sinh nhật',
      titleEn: 'Birthday gift',
      descriptionVi: 'Voucher sinh nhật (ví) — cấp tự động qua cron.',
      descriptionEn: 'Birthday wallet voucher — granted by the cron job.',
      type: VoucherType.PERCENT,
      isPublic: false,
      value: 15,
      maxDiscountCents: 10000,
    },
  ];
  for (const v of vouchers) {
    await prisma.voucher.upsert({ where: { code: v.code }, create: v, update: v });
  }

  console.log('Demo seed complete:');
  console.log(`  categories:   ${CATEGORIES.length} (${CATEGORIES.filter((c) => !c.parent).length} top-level)`);
  console.log(`  collections:  ${COLLECTIONS.length} (${COLLECTIONS.filter((c) => c.featuredOnHome).length} featured)`);
  console.log(`  products:     ${PRODUCTS.length} (${PRODUCTS.filter((p) => p.salePriceCents).length} on sale)`);
  console.log(`  variants:     ${variantCount}`);
  console.log(`  images:       ${imageCount}`);
  console.log(`  memberships:  ${membershipCount}`);
  console.log(`  vouchers:     ${vouchers.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
