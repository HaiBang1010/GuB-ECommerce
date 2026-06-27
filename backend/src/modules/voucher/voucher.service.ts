import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Voucher, VoucherType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../iam/user/user.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { VoucherErrorCode } from './dto/voucher-error.dto';

// Outcome of a successful read-only validation (preview + the pre-tx check in
// checkout). `voucher` is carried so the caller can redeem it inside its own tx.
export type VoucherValidation = {
  voucher: Voucher;
  voucherId: string;
  voucherCode: string;
  discountCents: number;
};

// One page of admin vouchers. `total` is the count over the same filter.
export type PaginatedVouchers = {
  items: Voucher[];
  total: number;
  page: number;
  pageSize: number;
};

// A wallet entry: the granted voucher + how many times THIS user has redeemed it.
export type WalletVoucher = Voucher & { userUsedCount: number };

// Codes are case-insensitive: stored and looked up UPPERCASE (so the @unique index
// still applies — no citext needed).
function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Owns the `voucher` schema (Voucher + UserVoucher wallet/ledger). The order module
 * calls `validate` (read-only) then `redeem` (inside its checkout transaction) in
 * process — vouchers are never JOINed from the ordering schema, and this service
 * never queries `ordering`/`iam` tables (it resolves grantees via UserService).
 */
@Injectable()
export class VoucherService {
  constructor(
    private readonly prisma: PrismaService,
    // Resolve/validate a grantee for wallet grants (in-process, never iam tables).
    private readonly users: UserService,
  ) {}

  // ---------------------------------------------------------------------------
  // Discount math — pure, integer cents, never negative, never over subtotal.
  // ---------------------------------------------------------------------------
  computeDiscount(
    voucher: Pick<Voucher, 'type' | 'value' | 'maxDiscountCents'>,
    subtotalCents: number,
  ): number {
    let discount: number;
    if (voucher.type === VoucherType.PERCENT) {
      discount = Math.floor((subtotalCents * voucher.value) / 100);
      if (voucher.maxDiscountCents != null) {
        discount = Math.min(discount, voucher.maxDiscountCents);
      }
    } else {
      discount = voucher.value; // FIXED amount in cents
    }
    return Math.max(0, Math.min(discount, subtotalCents));
  }

  // ---------------------------------------------------------------------------
  // Validation (read-only): preview endpoint + the pre-transaction check in
  // checkout. Throws a structured 4xx (code + message) on any failure.
  // ---------------------------------------------------------------------------
  async validate(
    code: string,
    userId: string,
    subtotalCents: number,
  ): Promise<VoucherValidation> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code: normalizeCode(code) },
    });
    if (!voucher || voucher.archivedAt !== null) {
      this.fail(VoucherErrorCode.NOT_FOUND, 'Voucher not found.');
    }

    const now = new Date();
    if (voucher.validFrom && voucher.validFrom > now) {
      this.fail(VoucherErrorCode.NOT_YET_VALID, 'This voucher is not active yet.');
    }
    if (voucher.validTo && voucher.validTo < now) {
      this.fail(VoucherErrorCode.EXPIRED, 'This voucher has expired.');
    }
    if (voucher.minOrderCents != null && subtotalCents < voucher.minOrderCents) {
      this.fail(
        VoucherErrorCode.MIN_ORDER_NOT_MET,
        'Order subtotal is below the voucher minimum.',
        { minOrderCents: voucher.minOrderCents },
      );
    }
    if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
      this.fail(VoucherErrorCode.USED_UP, 'This voucher has reached its usage limit.');
    }

    // Per-user + wallet gate. UserVoucher is the per-(user,voucher) ledger.
    const grant = await this.prisma.userVoucher.findUnique({
      where: { userId_voucherId: { userId, voucherId: voucher.id } },
    });
    if (!voucher.isPublic && !grant) {
      this.fail(
        VoucherErrorCode.NOT_AVAILABLE,
        'This voucher is not available for your account.',
      );
    }
    if (
      voucher.perUserLimit != null &&
      (grant?.usedCount ?? 0) >= voucher.perUserLimit
    ) {
      this.fail(VoucherErrorCode.USER_LIMIT, 'You have already used this voucher.');
    }

    return {
      voucher,
      voucherId: voucher.id,
      voucherCode: voucher.code,
      discountCents: this.computeDiscount(voucher, subtotalCents),
    };
  }

  // ---------------------------------------------------------------------------
  // Redeem — runs INSIDE the caller's checkout transaction (alongside the atomic
  // stock decrement). Atomic guards make limits race-safe; throwing here rolls the
  // whole order back, so a voucher is never consumed by a failed order.
  // ---------------------------------------------------------------------------
  async redeem(
    tx: Prisma.TransactionClient,
    voucher: Voucher,
    userId: string,
  ): Promise<void> {
    // 1) Global cap — atomic guarded increment (mirrors the stock-decrement guard).
    const where: Prisma.VoucherWhereInput = { id: voucher.id, archivedAt: null };
    if (voucher.usageLimit != null) {
      where.usedCount = { lt: voucher.usageLimit };
    }
    const global = await tx.voucher.updateMany({
      where,
      data: { usedCount: { increment: 1 } },
    });
    if (global.count === 0) {
      this.fail(VoucherErrorCode.USED_UP, 'This voucher has reached its usage limit.');
    }

    // 2) Per-user cap — increment an existing grant guarded by perUserLimit.
    const userWhere: Prisma.UserVoucherWhereInput = {
      userId,
      voucherId: voucher.id,
    };
    if (voucher.perUserLimit != null) {
      userWhere.usedCount = { lt: voucher.perUserLimit };
    }
    const perUser = await tx.userVoucher.updateMany({
      where: userWhere,
      data: { usedCount: { increment: 1 }, usedAt: new Date() },
    });
    if (perUser.count > 0) return;

    // No usable grant row was updated — decide why.
    const existing = await tx.userVoucher.findUnique({
      where: { userId_voucherId: { userId, voucherId: voucher.id } },
    });
    if (existing) {
      // Row exists but is at the per-user limit.
      this.fail(VoucherErrorCode.USER_LIMIT, 'You have already used this voucher.');
    }
    if (!voucher.isPublic) {
      // Wallet-only with no grant → not redeemable.
      this.fail(
        VoucherErrorCode.NOT_AVAILABLE,
        'This voucher is not available for your account.',
      );
    }
    // PUBLIC, first redemption for this user → create the ledger row.
    try {
      await tx.userVoucher.create({
        data: { userId, voucherId: voucher.id, usedCount: 1, usedAt: new Date() },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // A concurrent redemption created the row first → the per-user race.
        this.fail(VoucherErrorCode.USER_LIMIT, 'You have already used this voucher.');
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Wallet (storefront): the caller's still-usable granted vouchers.
  // ---------------------------------------------------------------------------
  async listWalletForUser(userId: string): Promise<WalletVoucher[]> {
    const now = new Date();
    // UserVoucher ⋈ Voucher is a real relation WITHIN the voucher schema (allowed).
    const grants = await this.prisma.userVoucher.findMany({
      where: { userId, voucher: { archivedAt: null } },
      include: { voucher: true },
      orderBy: { createdAt: 'desc' },
    });
    return grants
      .filter((g) => {
        const v = g.voucher;
        if (v.validFrom && v.validFrom > now) return false;
        if (v.validTo && v.validTo < now) return false;
        if (v.usageLimit != null && v.usedCount >= v.usageLimit) return false;
        if (v.perUserLimit != null && g.usedCount >= v.perUserLimit) return false;
        return true;
      })
      .map((g) => ({ ...g.voucher, userUsedCount: g.usedCount }));
  }

  // ---------------------------------------------------------------------------
  // Admin CRUD (ADMIN-guarded at the controller).
  // ---------------------------------------------------------------------------
  async listForAdmin(filters: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedVouchers> {
    const where: Prisma.VoucherWhereInput = {};
    const term = filters.search?.trim();
    if (term) {
      where.code = { contains: term.toUpperCase(), mode: 'insensitive' };
    }
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    const [total, items] = await Promise.all([
      this.prisma.voucher.count({ where }),
      this.prisma.voucher.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async getById(id: string): Promise<Voucher> {
    const voucher = await this.prisma.voucher.findUnique({ where: { id } });
    if (!voucher) {
      throw new NotFoundException('Voucher not found.');
    }
    return voucher;
  }

  async create(dto: CreateVoucherDto): Promise<Voucher> {
    this.assertValueRange(dto.type, dto.value);
    this.assertWindow(
      dto.validFrom ? new Date(dto.validFrom) : null,
      dto.validTo ? new Date(dto.validTo) : null,
    );
    const data: Prisma.VoucherCreateInput = {
      code: normalizeCode(dto.code),
      type: dto.type,
      value: dto.value,
      isPublic: dto.isPublic ?? true,
      minOrderCents: dto.minOrderCents ?? null,
      maxDiscountCents: dto.maxDiscountCents ?? null,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
      usageLimit: dto.usageLimit ?? null,
      perUserLimit: dto.perUserLimit ?? null,
    };
    try {
      return await this.prisma.voucher.create({ data });
    } catch (err) {
      throw this.mapUniqueCode(err);
    }
  }

  async update(id: string, dto: UpdateVoucherDto): Promise<Voucher> {
    const existing = await this.getById(id);
    const type = dto.type ?? existing.type;
    if (dto.value !== undefined) {
      this.assertValueRange(type, dto.value);
    } else if (dto.type !== undefined) {
      // Type changed to PERCENT without a new value — re-check the existing value.
      this.assertValueRange(type, existing.value);
    }
    const from =
      dto.validFrom !== undefined
        ? dto.validFrom
          ? new Date(dto.validFrom)
          : null
        : existing.validFrom;
    const to =
      dto.validTo !== undefined
        ? dto.validTo
          ? new Date(dto.validTo)
          : null
        : existing.validTo;
    this.assertWindow(from, to);

    const data: Prisma.VoucherUpdateInput = {};
    if (dto.code !== undefined) data.code = normalizeCode(dto.code);
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.minOrderCents !== undefined) data.minOrderCents = dto.minOrderCents;
    if (dto.maxDiscountCents !== undefined) {
      data.maxDiscountCents = dto.maxDiscountCents;
    }
    if (dto.validFrom !== undefined) {
      data.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    }
    if (dto.validTo !== undefined) {
      data.validTo = dto.validTo ? new Date(dto.validTo) : null;
    }
    if (dto.usageLimit !== undefined) data.usageLimit = dto.usageLimit;
    if (dto.perUserLimit !== undefined) data.perUserLimit = dto.perUserLimit;

    try {
      return await this.prisma.voucher.update({ where: { id }, data });
    } catch (err) {
      throw this.mapUniqueCode(err);
    }
  }

  // Soft delete — vouchers are archived, never hard-deleted (orders snapshot the
  // code, but the live row may still be referenced by wallets/audits).
  async archive(id: string): Promise<Voucher> {
    await this.getById(id);
    return this.prisma.voucher.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  // Grant a (wallet-only) voucher to a user. Idempotent: re-granting is a no-op.
  async grant(voucherId: string, userId: string): Promise<Voucher> {
    const voucher = await this.getById(voucherId);
    await this.users.assertActive(userId); // 404 if the user is missing/archived
    try {
      await this.prisma.userVoucher.create({ data: { userId, voucherId } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Already granted — idempotent.
        return voucher;
      }
      throw err;
    }
    return voucher;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  // Throws a structured 4xx whose `code` the storefront maps to an i18n message.
  // Typed `never` so callers narrow after an `if (...) this.fail(...)`.
  private fail(
    code: VoucherErrorCode,
    message: string,
    meta: Record<string, unknown> = {},
  ): never {
    if (code === VoucherErrorCode.NOT_FOUND) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message,
        code,
        ...meta,
      });
    }
    if (code === VoucherErrorCode.USED_UP || code === VoucherErrorCode.USER_LIMIT) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message,
        code,
        ...meta,
      });
    }
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message,
      code,
      ...meta,
    });
  }

  private assertValueRange(type: VoucherType, value: number): void {
    if (value <= 0) {
      throw new BadRequestException('Voucher value must be greater than 0.');
    }
    if (type === VoucherType.PERCENT && value > 100) {
      throw new BadRequestException(
        'A percentage voucher value must be between 1 and 100.',
      );
    }
  }

  private assertWindow(from: Date | null, to: Date | null): void {
    if (from && to && from >= to) {
      throw new BadRequestException('validFrom must be before validTo.');
    }
  }

  private mapUniqueCode(err: unknown): Error {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException('A voucher with this code already exists.');
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
