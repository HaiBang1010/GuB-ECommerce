import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Address, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

/**
 * The user's address book. Every operation is scoped to the owning userId — a
 * caller can only ever read or mutate their own addresses (ownership is checked
 * in the service, 404 on mismatch so existence never leaks).
 *
 * Invariant: at most one active address per user has isDefault=true. Writes that
 * touch the default flag clear the previous default in the SAME transaction.
 */
@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  // Active addresses only, default first then newest.
  async list(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    // The first address a user adds is always their default.
    const activeCount = await this.prisma.address.count({
      where: { userId, archivedAt: null },
    });
    const makeDefault = dto.isDefault === true || activeCount === 0;

    const data: Prisma.AddressUncheckedCreateInput = {
      userId,
      fullName: dto.fullName,
      phone: dto.phone,
      line1: dto.line1,
      line2: dto.line2 ?? null,
      ward: dto.ward ?? null,
      district: dto.district ?? null,
      city: dto.city,
      postalCode: dto.postalCode ?? null,
      isDefault: makeDefault,
      // Omit country when absent so the DB default ("VN") applies.
      ...(dto.country !== undefined ? { country: dto.country } : {}),
    };

    if (!makeDefault) {
      return this.prisma.address.create({ data });
    }

    // Clear the previous default and create the new one atomically.
    const [, created] = await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { userId, archivedAt: null, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.address.create({ data }),
    ]);
    return created;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    await this.assertOwned(userId, id);

    const data: Prisma.AddressUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.line1 !== undefined) data.line1 = dto.line1;
    if (dto.line2 !== undefined) data.line2 = dto.line2;
    if (dto.ward !== undefined) data.ward = dto.ward;
    if (dto.district !== undefined) data.district = dto.district;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode;

    return this.prisma.address.update({ where: { id }, data });
  }

  // Soft delete. A removed address can never be the default afterwards.
  async archive(userId: string, id: string): Promise<Address> {
    const existing = await this.assertOwned(userId, id);
    if (existing.archivedAt !== null) {
      return existing; // idempotent
    }
    return this.prisma.address.update({
      where: { id },
      data: { archivedAt: new Date(), isDefault: false },
    });
  }

  async setDefault(userId: string, id: string): Promise<Address> {
    const existing = await this.assertOwned(userId, id);
    if (existing.archivedAt !== null) {
      throw new BadRequestException(
        'Cannot set an archived address as default.',
      );
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { userId, archivedAt: null, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.address.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Cross-module API — called IN-PROCESS (e.g. ordering snapshots the shipping
  // address at checkout). Returns the active, owned address or throws.
  // ---------------------------------------------------------------------------
  async getOwnedActive(userId: string, id: string): Promise<Address> {
    const address = await this.assertOwned(userId, id);
    if (address.archivedAt !== null) {
      throw new NotFoundException('Address not found.');
    }
    return address;
  }

  // Ownership check: 404 (not 403) so we never reveal that an id exists for
  // another user.
  private async assertOwned(userId: string, id: string): Promise<Address> {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== userId) {
      throw new NotFoundException('Address not found.');
    }
    return address;
  }
}
