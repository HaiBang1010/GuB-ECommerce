import { Injectable } from '@nestjs/common';
import { Prisma, Profile } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Owns the iam.Profile row (1:1 with User, in-schema). The blank Profile is created
 * on first login (UserService.upsertOnLogin); this service is the user-facing
 * read/write. Exported from the @Global IamModule so the product size-suggestion can
 * read measurements in-process (no cross-schema JOIN — ARCHITECTURE §4.3).
 */
@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // The caller's own profile, or null when no row exists yet (users predating the
  // auto-create). Callers map null to "all empty".
  async getByUserId(userId: string): Promise<Profile | null> {
    return this.prisma.profile.findUnique({ where: { userId } });
  }

  // Upsert from a partial update: only the provided fields are written, and
  // `measurements` is replaced wholesale when present. Upsert (not update) is safe
  // for a user whose Profile row predates the first-login auto-create.
  async update(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    const fields: {
      heightCm?: number;
      weightKg?: number;
      measurements?: Prisma.InputJsonValue;
    } = {};
    if (dto.heightCm !== undefined) fields.heightCm = dto.heightCm;
    if (dto.weightKg !== undefined) fields.weightKg = dto.weightKg;
    if (dto.measurements !== undefined) {
      fields.measurements = dto.measurements as Prisma.InputJsonValue;
    }

    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...fields },
      update: fields,
    });
  }
}
