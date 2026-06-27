import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Review } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { ProductService } from '../product/product/product.service';
import { UserService } from '../iam/user/user.service';
import { AdminReplyDto } from './dto/admin-reply.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

// Storefront shape: a product's reviews plus its rating aggregate (average is null
// when there are no reviews). Exported so a later product-detail slice can reuse it.
export type ProductReviews = {
  summary: { average: number | null; count: number };
  items: Review[];
};

// An admin review row enriched with the product name + the author's identity, both
// resolved in-process from sibling modules (never a cross-schema JOIN). Each ref is
// null when the referenced row is gone.
export type ReviewAdminWithRefs = Review & {
  product: { nameVi: string; nameEn: string } | null;
  reviewer: { email: string; name: string | null } | null;
};

// One page of admin reviews. `total` is the count over the same filter.
export type PaginatedAdminReviews = {
  items: ReviewAdminWithRefs[];
  total: number;
  page: number;
  pageSize: number;
};

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    // Cross-module collaborators, called in-process (never their tables).
    private readonly orders: OrderService,
    private readonly products: ProductService,
    // Resolves the reviewer's identity for admin enrichment (in-process).
    private readonly users: UserService,
  ) {}

  /**
   * Create a purchased-only review. The productId is taken from the order item
   * SNAPSHOT (proof of purchase) — never trusted from the client. Allowed only
   * when the order item belongs to the caller and its order is DELIVERED (both
   * enforced in-process by OrderService). One review per (user, product) and per
   * order item: a pre-check returns a clean 409, and the unique indexes are the
   * race-safe backstop (P2002 -> 409).
   */
  async create(userId: string, dto: CreateReviewDto): Promise<Review> {
    const item = await this.orders.getDeliveredOrderItemForUser(
      userId,
      dto.orderItemId,
    );
    // Tolerates archived products on purpose: a review survives a later archive.
    await this.products.assertExists(item.productId);

    const existing = await this.prisma.review.findFirst({
      where: {
        OR: [
          { orderItemId: dto.orderItemId },
          { userId, productId: item.productId },
        ],
      },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this product.');
    }

    try {
      return await this.prisma.review.create({
        data: {
          userId,
          productId: item.productId,
          orderItemId: dto.orderItemId,
          rating: dto.rating,
          body: dto.body ?? null,
        },
      });
    } catch (err) {
      // A concurrent create won the unique race between the pre-check and here.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('You have already reviewed this product.');
      }
      throw err;
    }
  }

  /**
   * Edit the caller's own review. Only the rating/body are mutable (the
   * proof-of-purchase link is immutable); only the provided fields are written,
   * and `updatedAt` is bumped by Prisma. Ownership failure is 404 (owner idiom).
   */
  async updateOwn(
    userId: string,
    reviewId: string,
    dto: UpdateReviewDto,
  ): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review || review.userId !== userId) {
      throw new NotFoundException('Review not found.');
    }
    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
      },
    });
  }

  /**
   * Public storefront read: a product's reviews (newest first) plus its rating
   * aggregate. No product-existence check — an unknown product simply yields an
   * empty list + null average, which keeps this hot read path off a cross-module
   * call.
   */
  async getProductReviews(productId: string): Promise<ProductReviews> {
    const [items, agg] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: true,
      }),
    ]);
    return {
      summary: { average: agg._avg.rating, count: agg._count },
      items,
    };
  }

  // Admin list-all (ADMIN-guarded at the controller): every review, paginated and
  // optionally filtered by reply state, each enriched with the product name and the
  // reviewer's identity. Both enrichments are in-process service calls (no JOIN):
  // the product/iam tables are never queried from the review schema.
  async listAllForAdmin(filters: {
    page?: number;
    pageSize?: number;
    replied?: boolean;
  }): Promise<PaginatedAdminReviews> {
    const where: Prisma.ReviewWhereInput = {};
    if (filters.replied === true) where.adminReply = { not: null };
    else if (filters.replied === false) where.adminReply = null;

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    // count + page share the same `where`, so `total` reflects the filtered set.
    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Batch-resolve product names + reviewers (no N+1, no JOIN) and map onto the page.
    const productById = new Map(
      (
        await this.products.findManyByIds([
          ...new Set(rows.map((r) => r.productId)),
        ])
      ).map((p) => [p.id, p]),
    );
    const userById = new Map(
      (
        await this.users.findManyByIds([...new Set(rows.map((r) => r.userId))])
      ).map((u) => [u.id, u]),
    );
    const items = rows.map((review) => {
      const product = productById.get(review.productId);
      const user = userById.get(review.userId);
      return {
        ...review,
        product: product
          ? { nameVi: product.nameVi, nameEn: product.nameEn }
          : null,
        reviewer: user ? { email: user.email, name: user.name } : null,
      };
    });
    return { items, total, page, pageSize };
  }

  // Admin (ADMIN-guarded at the controller): attach/replace the admin reply on a
  // review and stamp the reply time. 404 when the review does not exist.
  async reply(reviewId: string, dto: AdminReplyDto): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Review not found.');
    }
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { adminReply: dto.reply, adminReplyAt: new Date() },
    });
  }
}
