import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma, SizeSystem } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// A category plus its nested active children (storefront tree node).
export type CategoryTreeNode = Category & { children: CategoryTreeNode[] };

// A category enriched with counts for the admin list (so the UI can warn what an
// archive would hide). `productCount`/`childCount` are ACTIVE only.
export type AdminCategory = Category & {
  productCount: number;
  childCount: number;
};

// Defensive cap against cyclic parentId data when walking the category tree.
const MAX_TREE_DEPTH = 50;

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Storefront (public) — archived rows and anything under an archived ancestor
  // are hidden. The archive cascade is enforced at READ time, never by writing
  // archivedAt onto children.
  // ---------------------------------------------------------------------------

  async getActiveTree(): Promise<CategoryTreeNode[]> {
    const active = await this.prisma.category.findMany({
      where: { archivedAt: null },
      orderBy: [{ nameEn: 'asc' }, { createdAt: 'asc' }],
    });

    // Group active children by parentId.
    const childrenByParent = new Map<string, Category[]>();
    for (const category of active) {
      if (category.parentId === null) continue;
      const siblings = childrenByParent.get(category.parentId) ?? [];
      siblings.push(category);
      childrenByParent.set(category.parentId, siblings);
    }

    // Build TOP-DOWN from roots and only descend into nodes we actually fetched.
    // A node whose parent is archived (and therefore absent from `active`) is never
    // reached, so it and its subtree drop out — this is the cascade.
    const build = (node: Category, depth: number): CategoryTreeNode => {
      const children =
        depth >= MAX_TREE_DEPTH
          ? []
          : (childrenByParent.get(node.id) ?? []).map((child) =>
              build(child, depth + 1),
            );
      return { ...node, children };
    };

    return active
      .filter((category) => category.parentId === null)
      .map((root) => build(root, 0));
  }

  async getActiveBySlug(slug: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category || category.archivedAt !== null) {
      throw new NotFoundException('Category not found.');
    }
    await this.assertNoArchivedAncestor(category);
    return category;
  }

  // ---------------------------------------------------------------------------
  // Admin — sees everything, including archived rows.
  // ---------------------------------------------------------------------------

  async findAllForAdmin(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { nameEn: 'asc' } });
  }

  // Admin list enriched with counts. `productCounts` (active products per categoryId)
  // is supplied by the controller via ProductService — this service NEVER queries the
  // product table (slice boundary, §4.3). `childCount` (active sub-categories) is
  // computed in-memory from the category rows. Both counts drive the archive warning.
  async listForAdmin(
    productCounts: Record<string, number>,
  ): Promise<AdminCategory[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: { nameEn: 'asc' },
    });
    const childCount = new Map<string, number>();
    for (const c of categories) {
      if (c.parentId !== null && c.archivedAt === null) {
        childCount.set(c.parentId, (childCount.get(c.parentId) ?? 0) + 1);
      }
    }
    return categories.map((c) => ({
      ...c,
      productCount: productCounts[c.id] ?? 0,
      childCount: childCount.get(c.id) ?? 0,
    }));
  }

  async findOneForAdmin(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found.');
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    if (dto.parentId !== undefined) {
      await this.assertParentUsable(dto.parentId);
    }

    const data: Prisma.CategoryUncheckedCreateInput = {
      nameVi: dto.nameVi,
      nameEn: dto.nameEn,
      slug: dto.slug,
      imageUrl: dto.imageUrl ?? null,
      parentId: dto.parentId ?? null,
      sizeSystem: dto.sizeSystem ?? null,
    };

    try {
      return await this.prisma.category.create({ data });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found.');
    }

    const data: Prisma.CategoryUpdateInput = {};
    if (dto.nameVi !== undefined) data.nameVi = dto.nameVi;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.slug !== undefined) data.slug = dto.slug;
    // null clears the image; a url sets it; absent leaves it untouched.
    if ('imageUrl' in dto) data.imageUrl = dto.imageUrl ?? null;
    // null clears the size system; a value sets it; absent leaves it untouched.
    if ('sizeSystem' in dto) data.sizeSystem = dto.sizeSystem ?? null;

    // Only touch the parent when the client actually sent `parentId`.
    if ('parentId' in dto) {
      if (dto.parentId === null || dto.parentId === undefined) {
        data.parent = { disconnect: true };
      } else {
        await this.assertParentAssignable(id, dto.parentId);
        data.parent = { connect: { id: dto.parentId } };
      }
    }

    try {
      return await this.prisma.category.update({ where: { id }, data });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async archive(id: string): Promise<Category> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found.');
    }
    // Idempotent: keep the original timestamp if already archived. Children are NOT
    // touched — they stay archivedAt=null and are hidden purely at read time.
    if (existing.archivedAt !== null) {
      return existing;
    }
    return this.prisma.category.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async restore(id: string): Promise<Category> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found.');
    }
    // Note: a restored child stays hidden on the storefront while its parent is
    // archived — correct, since visibility is decided by the ancestor chain.
    return this.prisma.category.update({
      where: { id },
      data: { archivedAt: null },
    });
  }

  // ---------------------------------------------------------------------------
  // Cross-module API — called IN-PROCESS by sibling slices (e.g. product).
  // These exist so another module never queries the `product.Category` table
  // directly; it asks the owning service instead. See ARCHITECTURE.md §4.3.
  // ---------------------------------------------------------------------------

  // Validate a categoryId a product wants to attach to. Node-level active check,
  // matching the parent-validation convention. Throws 400 if missing/archived.
  async assertActive(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.archivedAt !== null) {
      throw new BadRequestException('Category does not exist.');
    }
  }

  // True iff the category is active AND no ancestor is archived — i.e. it would
  // appear on the storefront tree. Mirrors the cascade in getActiveBySlug.
  async isCategoryVisible(categoryId: string): Promise<boolean> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.archivedAt !== null) return false;

    let current = category;
    for (let depth = 0; depth < MAX_TREE_DEPTH; depth++) {
      if (current.parentId === null) return true;
      const parent = await this.prisma.category.findUnique({
        where: { id: current.parentId },
      });
      if (!parent || parent.archivedAt !== null) return false;
      current = parent;
    }
    // Exceeded the depth cap → treat as bad data and hide it.
    return false;
  }

  // Cross-module (in-process): the category's size system for the rule-based size
  // suggestion. null when the category has none (or doesn't exist). Lets the size
  // suggestion pick a chart without another module querying product.Category.
  async getSizeSystem(categoryId: string): Promise<SizeSystem | null> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { sizeSystem: true },
    });
    return category?.sizeSystem ?? null;
  }

  // The set of category ids visible on the storefront (active + no archived
  // ancestor). Computed top-down like getActiveTree so a subtree under an
  // archived ancestor drops out. Lets a caller filter a product list in one pass.
  async getVisibleCategoryIds(): Promise<Set<string>> {
    const active = await this.prisma.category.findMany({
      where: { archivedAt: null },
    });

    const childrenByParent = new Map<string, Category[]>();
    for (const category of active) {
      if (category.parentId === null) continue;
      const siblings = childrenByParent.get(category.parentId) ?? [];
      siblings.push(category);
      childrenByParent.set(category.parentId, siblings);
    }

    const visible = new Set<string>();
    const visit = (node: Category, depth: number): void => {
      visible.add(node.id);
      if (depth >= MAX_TREE_DEPTH) return;
      for (const child of childrenByParent.get(node.id) ?? []) {
        visit(child, depth + 1);
      }
    };
    for (const root of active.filter((c) => c.parentId === null)) {
      visit(root, 0);
    }
    return visible;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  // 404 if any ancestor in the parent chain is archived (cascade for the detail
  // route). Depth-capped against cyclic data.
  private async assertNoArchivedAncestor(category: Category): Promise<void> {
    let current = category;
    for (let depth = 0; depth < MAX_TREE_DEPTH; depth++) {
      if (current.parentId === null) return;
      const parent = await this.prisma.category.findUnique({
        where: { id: current.parentId },
      });
      if (!parent || parent.archivedAt !== null) {
        throw new NotFoundException('Category not found.');
      }
      current = parent;
    }
    // Exceeded the depth cap → treat as bad data and hide it.
    throw new NotFoundException('Category not found.');
  }

  private async assertParentUsable(parentId: string): Promise<Category> {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.archivedAt !== null) {
      throw new BadRequestException('Parent category does not exist.');
    }
    return parent;
  }

  // Validate a proposed new parent for category `id`: it must exist, be active, not
  // be the category itself, and not be one of its descendants (which would form a
  // cycle).
  private async assertParentAssignable(
    id: string,
    parentId: string,
  ): Promise<void> {
    if (parentId === id) {
      throw new BadRequestException('A category cannot be its own parent.');
    }
    const parent = await this.assertParentUsable(parentId);

    // Walk UP from the proposed parent; reaching `id` means `parentId` is a
    // descendant of `id` → cycle. Depth-capped against pre-existing bad data.
    let current: Category | null = parent;
    for (let depth = 0; depth < MAX_TREE_DEPTH && current !== null; depth++) {
      if (current.parentId === null) return;
      if (current.parentId === id) {
        throw new BadRequestException(
          'Cannot move a category under its own descendant.',
        );
      }
      current = await this.prisma.category.findUnique({
        where: { id: current.parentId },
      });
    }
  }

  // Translate a unique-constraint hit on `slug` into 409; rethrow everything else.
  private mapWriteError(error: unknown): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException('A category with this slug already exists.');
    }
    return error instanceof Error
      ? error
      : new Error('Unknown error while writing category.');
  }
}
