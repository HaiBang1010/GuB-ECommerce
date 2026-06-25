import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Review } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { ProductService } from '../product/product/product.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    // Cross-module collaborators, called in-process (never their tables).
    private readonly orders: OrderService,
    private readonly products: ProductService,
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
}
