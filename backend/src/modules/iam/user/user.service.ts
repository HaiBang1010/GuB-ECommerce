import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SupabaseClaims } from '../auth/supabase-jwt.service';

// A User row with its (in-schema) Profile relation, for the admin user-detail page.
export type UserWithProfile = Prisma.UserGetPayload<{
  include: { profile: true };
}>;

// One page of users for the admin users list. `total` is the count over the same
// search filter.
export type PaginatedAdminUsers = {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Owns the iam.User aggregate. Identity originates in Supabase Auth; this service
 * keeps the local mirror in sync and is the in-process entry point other modules
 * use to resolve a userId (they never query the `iam` schema directly — see
 * ARCHITECTURE.md §4.3).
 */
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert the User (and a blank Profile on first login) from verified Supabase
   * claims. Solves ARCHITECTURE.md §5.4: the JWT is the source of truth for
   * identity, but the row must exist locally before any module can reference
   * userId. Idempotent — safe to run on every authenticated request.
   *
   * IMPORTANT: `role` is intentionally NEVER written on update. A user promoted
   * to ADMIN in the DB must not be silently demoted to CUSTOMER on next login.
   */
  async upsertOnLogin(claims: SupabaseClaims): Promise<User> {
    return this.prisma.user.upsert({
      where: { id: claims.sub },
      create: {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        profile: { create: {} },
      },
      update: {
        email: claims.email,
        // Only overwrite the name when the token actually carries one.
        ...(claims.name !== null ? { name: claims.name } : {}),
      },
    });
  }

  // Cross-module read (in-process). Returns null when absent so callers can
  // decide how to react.
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // Exact (case-insensitive) email lookup — for the admin "grant voucher by email"
  // flow. Returns null when no user has that email. In-process; the iam schema is
  // never queried from another module directly.
  async findByEmail(email: string): Promise<User | null> {
    const term = email.trim();
    if (term === '') return null;
    return this.prisma.user.findFirst({
      where: { email: { equals: term, mode: 'insensitive' } },
    });
  }

  // The user plus its Profile (height/weight/measurements), for the admin
  // user-detail page. Profile has no service of its own; this single-relation
  // include stays within the `iam` schema (no cross-schema work).
  async findByIdWithProfile(id: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  // Convenience for callers that require an active account; throws when the user
  // is missing or archived. Mirrors CategoryService.assertActive.
  async assertActive(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user || user.archivedAt !== null) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  // Admin users list: every user, paginated, optionally filtered by a name/email
  // search. Single-module read (the iam schema), so a plain query — no enrichment.
  async listForAdmin(filters: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedAdminUsers> {
    const where: Prisma.UserWhereInput = {};
    const term = filters.search?.trim();
    if (term) {
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
      ];
    }
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    // count + page share the same `where`, so `total` reflects the filtered set.
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  // Cross-module batch read (in-process): resolve many users at once so callers
  // (e.g. the admin order list) can enrich rows with customer info WITHOUT a
  // cross-schema JOIN — they map the result by id themselves. Includes archived
  // users so an admin still sees who an old order belongs to.
  async findManyByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return this.prisma.user.findMany({ where: { id: { in: ids } } });
  }

  // Cross-module search (in-process): return the ids of users whose name or email
  // matches `q` (case-insensitive substring). Returns ids ONLY, so the caller
  // filters its own rows by userId — the iam schema is never JOINed from outside.
  async searchIdsByNameOrEmail(q: string): Promise<string[]> {
    const term = q.trim();
    if (term === '') return [];
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 200,
    });
    return users.map((u) => u.id);
  }
}
