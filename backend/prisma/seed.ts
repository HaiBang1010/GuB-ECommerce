// GuB demo seed — populates the catalog so every storefront/home section renders with
// real data (category grid, featured-collection carousels, on-sale + new-arrivals rows,
// image-bearing product grid) and /collections/[slug] + size suggestion are testable.
// It also seeds demo customers + orders (see seedDemoOrders) so the admin ANALYTICS
// dashboard shows real numbers (revenue, top spenders/products, voucher usage, low stock).
//
// Images are ONLINE PLACEHOLDERS (picsum.photos) — no Cloudinary, no upload.
// Money is integer cents. Does NOT touch the schema, auth, or migrations (data only).
//
// IDEMPOTENT: re-running upserts by unique key (slug / code) and, per product, replaces
// its own variants/images (deleteMany scoped to that productId → recreate); the demo
// orders/customers are scoped to the `demo-order-` / `demo-user-` id prefix (deleted then
// rebuilt). No unique collisions, no duplicates, no destructive DROP. Reset = run it again.
//
// Run: `npx prisma db seed` (from backend/, DB up via docker compose). See backend README.

import {
  PrismaClient,
  Prisma,
  SizeSystem,
  VoucherType,
  OrderStatus,
  Role,
} from '@prisma/client';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const now = Date.now();

// Small deterministic PRNG (mulberry32) so the demo orders are REPRODUCIBLE — a
// re-run rebuilds the exact same dataset (paired with the scoped delete below), so
// the analytics dashboard is stable between seeds.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  const voucherIdByCode = new Map<string, string>();
  for (const v of vouchers) {
    const row = await prisma.voucher.upsert({
      where: { code: v.code },
      create: v,
      update: v,
    });
    voucherIdByCode.set(row.code, row.id);
  }

  // Demo orders + customers so the admin analytics dashboard renders real numbers.
  const orderStats = await seedDemoOrders(voucherIdByCode.get('SAVE10') ?? null);

  console.log('Demo seed complete:');
  console.log(`  categories:   ${CATEGORIES.length} (${CATEGORIES.filter((c) => !c.parent).length} top-level)`);
  console.log(`  collections:  ${COLLECTIONS.length} (${COLLECTIONS.filter((c) => c.featuredOnHome).length} featured)`);
  console.log(`  products:     ${PRODUCTS.length} (${PRODUCTS.filter((p) => p.salePriceCents).length} on sale)`);
  console.log(`  variants:     ${variantCount}`);
  console.log(`  images:       ${imageCount}`);
  console.log(`  memberships:  ${membershipCount}`);
  console.log(`  vouchers:     ${vouchers.length}`);
  console.log(`  demo users:   ${orderStats.users}`);
  console.log(`  demo orders:  ${orderStats.orders} (${orderStats.paid} paid)`);
  console.log(`  low-stock:    ${orderStats.lowStock} variants forced low`);
}

// --- Demo orders + customers (for the analytics dashboard) --------------------
// Idempotent + SCOPED: everything is keyed by the `demo-user-` / `demo-order-` id
// prefix, so a re-run deletes exactly its own rows (children first — real FK) and
// rebuilds them; real users/orders and the catalog are never touched. Demo users
// have no Supabase Auth entry, so they can't log in (harmless — they only give the
// top-spenders chart real names). Order.userId is a scalar cross-module ref (no DB
// FK to iam.User), so synthetic ids are accepted. Money is integer cents.
async function seedDemoOrders(
  save10VoucherId: string | null,
): Promise<{ users: number; orders: number; paid: number; lowStock: number }> {
  const USER_COUNT = 6;
  const ORDER_COUNT = 40;
  const rand = mulberry32(0x51ed); // fixed seed → reproducible

  // Wipe prior demo data (children before parents due to the real ordering FKs).
  await prisma.orderStatusHistory.deleteMany({
    where: { orderId: { startsWith: 'demo-order-' } },
  });
  await prisma.orderItem.deleteMany({
    where: { orderId: { startsWith: 'demo-order-' } },
  });
  await prisma.order.deleteMany({ where: { id: { startsWith: 'demo-order-' } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: 'demo-user-' } } });

  // Demo customers, signups spread across the last 90 days (feeds new-users chart).
  const names = ['Alice', 'Bao', 'Chi', 'Duy', 'Emma', 'Phuc'];
  const userIds: string[] = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const id = `demo-user-${i + 1}`;
    userIds.push(id);
    await prisma.user.create({
      data: {
        id,
        email: `demo${i + 1}@example.com`,
        name: `${names[i % names.length]} Demo`,
        role: Role.CUSTOMER,
        createdAt: new Date(now - Math.floor(rand() * 90) * DAY),
      },
    });
  }

  // Buyable variants (+ owning product for the snapshot name & effective price).
  const allVariants = await prisma.productVariant.findMany({
    where: { archivedAt: null },
    include: {
      product: {
        select: { id: true, nameVi: true, nameEn: true, salePriceCents: true },
      },
    },
  });
  if (allVariants.length === 0) {
    return { users: USER_COUNT, orders: 0, paid: 0, lowStock: 0 };
  }

  // Weighted status pool — mostly paid (so revenue/AOV are meaningful), a few
  // pending/cancelled/refunded for the orders-by-status breakdown.
  const STATUS_POOL: OrderStatus[] = [
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERED,
    OrderStatus.SHIPPED,
    OrderStatus.SHIPPED,
    OrderStatus.PROCESSING,
    OrderStatus.PAID,
    OrderStatus.PAID,
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ];
  const PAID_STATUSES = new Set<OrderStatus>([
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.REFUNDED,
  ]);
  const SPENT = new Set<OrderStatus>([
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ]);

  // Build the status timeline up to the target status (increasing timestamps).
  function history(
    status: OrderStatus,
    createdAt: Date,
  ): Prisma.OrderStatusHistoryCreateManyOrderInput[] {
    const h: Prisma.OrderStatusHistoryCreateManyOrderInput[] = [
      { status: OrderStatus.PENDING_PAYMENT, createdAt },
    ];
    const at = (hrs: number) => new Date(createdAt.getTime() + hrs * HOUR);
    if (status === OrderStatus.PENDING_PAYMENT) return h;
    if (status === OrderStatus.CANCELLED) {
      h.push({ status: OrderStatus.CANCELLED, createdAt: at(1) });
      return h;
    }
    h.push({ status: OrderStatus.PAID, createdAt: at(1) });
    if (status === OrderStatus.PAID) return h;
    if (status === OrderStatus.REFUNDED) {
      h.push({ status: OrderStatus.REFUNDED, createdAt: at(24) });
      return h;
    }
    h.push({ status: OrderStatus.PROCESSING, createdAt: at(24) });
    if (status === OrderStatus.PROCESSING) return h;
    h.push({ status: OrderStatus.SHIPPED, createdAt: at(48) });
    if (status === OrderStatus.SHIPPED) return h;
    h.push({ status: OrderStatus.DELIVERED, createdAt: at(96) });
    return h;
  }

  let paid = 0;
  for (let n = 0; n < ORDER_COUNT; n++) {
    const status = STATUS_POOL[Math.floor(rand() * STATUS_POOL.length)];
    const userId = userIds[Math.floor(rand() * userIds.length)];
    const createdAt = new Date(now - Math.floor(rand() * 90) * DAY);

    // 1–3 distinct line items.
    const itemCount = 1 + Math.floor(rand() * 3);
    const picked = new Set<number>();
    const items: Prisma.OrderItemCreateManyOrderInput[] = [];
    let subtotalCents = 0;
    while (items.length < itemCount && picked.size < allVariants.length) {
      const idx = Math.floor(rand() * allVariants.length);
      if (picked.has(idx)) continue;
      picked.add(idx);
      const v = allVariants[idx];
      const qty = 1 + Math.floor(rand() * 3);
      const sale = v.product.salePriceCents;
      // Effective (charged) price — the sale only when it undercuts the variant.
      const unit = sale != null && sale < v.priceCents ? sale : v.priceCents;
      subtotalCents += unit * qty;
      items.push({
        variantId: v.id,
        productId: v.productId,
        productNameVi: v.product.nameVi,
        productNameEn: v.product.nameEn,
        size: v.size,
        color: v.color,
        unitPriceCents: unit,
        quantity: qty,
      });
    }

    // Apply SAVE10 to ~35% of eligible orders (min order $20, cap $50).
    let voucherId: string | null = null;
    let voucherCode: string | null = null;
    let discountCents = 0;
    if (save10VoucherId && subtotalCents >= 2000 && rand() < 0.35) {
      voucherId = save10VoucherId;
      voucherCode = 'SAVE10';
      discountCents = Math.min(Math.floor((subtotalCents * 10) / 100), 5000);
    }
    const totalCents = subtotalCents - discountCents;
    if (SPENT.has(status)) paid++;

    const address: Prisma.InputJsonValue = {
      fullName: `${names[n % names.length]} Demo`,
      phone: '0900000000',
      line1: `${n + 1} Demo Street`,
      city: 'HCMC',
      country: 'VN',
    };

    await prisma.order.create({
      data: {
        id: `demo-order-${n + 1}`,
        userId,
        status,
        subtotalCents,
        discountCents,
        totalCents,
        voucherId,
        voucherCode,
        shippingAddress: address,
        placedAt: PAID_STATUSES.has(status) ? createdAt : null,
        createdAt,
        items: { createMany: { data: items } },
        statusHistory: { createMany: { data: history(status, createdAt) } },
      },
    });
  }

  // Force a few variants low so the low-stock panel shows data at the default
  // threshold (the catalog seed gives every variant stock 10–40). Deterministic:
  // the lowest-SKU variants. Re-run safe — the catalog loop resets stock first.
  const lowTargets = [...allVariants]
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .slice(0, 3);
  const lowValues = [2, 4, 5];
  for (let i = 0; i < lowTargets.length; i++) {
    await prisma.productVariant.update({
      where: { id: lowTargets[i].id },
      data: { stockQty: lowValues[i] },
    });
  }

  return { users: USER_COUNT, orders: ORDER_COUNT, paid, lowStock: lowTargets.length };
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
