import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SupabaseClaims } from '../auth/supabase-jwt.service';

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

  // Convenience for callers that require an active account; throws when the user
  // is missing or archived. Mirrors CategoryService.assertActive.
  async assertActive(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user || user.archivedAt !== null) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }
}
