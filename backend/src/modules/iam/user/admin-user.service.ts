import { Injectable, NotFoundException } from '@nestjs/common';
import { Address, Prisma, Role } from '@prisma/client';
import { AddressService } from '../address/address.service';
import {
  OrderService,
  OrderStats,
  OrderWithDetail,
} from '../../order/order.service';
import { UserService } from './user.service';

// The composed admin user-detail payload. Built in-process from iam (user/profile/
// addresses) and the order module (stats/recent) — never a cross-schema JOIN. Uses
// Prisma payload types as the runtime shape; AdminUserDetailResponseDto documents it
// for OpenAPI (same split the order admin controller uses).
export type AdminUserDetail = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  birthday: Date | null;
  createdAt: Date;
  profile: {
    heightCm: number | null;
    weightKg: number | null;
    measurements: Prisma.JsonValue;
  } | null;
  addresses: Address[];
  stats: OrderStats;
  recentOrders: OrderWithDetail[];
};

const RECENT_ORDERS_LIMIT = 5;

@Injectable()
export class AdminUserService {
  constructor(
    private readonly users: UserService,
    private readonly addresses: AddressService,
    // OrderModule exports OrderService; iam imports it (acyclic — nothing imports
    // the @Global IamModule). Order stats are owned by the order module.
    private readonly orders: OrderService,
  ) {}

  // Compose one customer's full admin view. Admins can inspect archived users too,
  // so this does NOT use assertActive — a missing row is the only 404.
  async getDetail(userId: string): Promise<AdminUserDetail> {
    const user = await this.users.findByIdWithProfile(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    const [addresses, stats, recentOrders] = await Promise.all([
      this.addresses.list(userId),
      this.orders.getStatsForUser(userId),
      this.orders.listRecentForUser(userId, RECENT_ORDERS_LIMIT),
    ]);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      birthday: user.birthday,
      createdAt: user.createdAt,
      profile: user.profile
        ? {
            heightCm: user.profile.heightCm,
            weightKg: user.profile.weightKg,
            measurements: user.profile.measurements,
          }
        : null,
      addresses,
      stats,
      recentOrders,
    };
  }
}
