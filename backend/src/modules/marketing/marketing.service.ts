import { Injectable, NotFoundException } from '@nestjs/common';
import { Banner, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

// Optional copy: a blank/whitespace string clears the field to null.
function emptyToNull(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Active banners first by sortOrder, then oldest first as a stable tiebreaker.
const BANNER_ORDER: Prisma.BannerOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

/**
 * Owns the `marketing` schema (Banner). Storefront reads active banners via
 * `listActive`; admin manages them via the CRUD methods. No cross-schema JOINs —
 * a banner references nothing in other modules.
 */
@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  // Storefront: visible banners only (active + not archived), display order.
  listActive(): Promise<Banner[]> {
    return this.prisma.banner.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: BANNER_ORDER,
    });
  }

  // Admin: every non-archived banner (incl. inactive), same display order.
  listForAdmin(): Promise<Banner[]> {
    return this.prisma.banner.findMany({
      where: { archivedAt: null },
      orderBy: BANNER_ORDER,
    });
  }

  async getById(id: string): Promise<Banner> {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException('Banner not found.');
    }
    return banner;
  }

  create(dto: CreateBannerDto): Promise<Banner> {
    return this.prisma.banner.create({
      data: {
        imageUrl: dto.imageUrl.trim(),
        linkUrl: emptyToNull(dto.linkUrl),
        title: emptyToNull(dto.title),
        alt: emptyToNull(dto.alt),
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateBannerDto): Promise<Banner> {
    await this.getById(id); // 404 when missing
    const data: Prisma.BannerUpdateInput = {};
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl.trim();
    if (dto.linkUrl !== undefined) data.linkUrl = emptyToNull(dto.linkUrl);
    if (dto.title !== undefined) data.title = emptyToNull(dto.title);
    if (dto.alt !== undefined) data.alt = emptyToNull(dto.alt);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.banner.update({ where: { id }, data });
  }

  // Soft delete — banners are archived, never hard-deleted (convention).
  async archive(id: string): Promise<Banner> {
    await this.getById(id);
    return this.prisma.banner.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }
}
