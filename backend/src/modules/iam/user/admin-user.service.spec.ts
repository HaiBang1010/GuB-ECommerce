import { NotFoundException } from '@nestjs/common';
import { AdminUserService } from './admin-user.service';
import { UserService } from './user.service';
import { AddressService } from '../address/address.service';
import { OrderService } from '../../order/order.service';

describe('AdminUserService', () => {
  let users: { findByIdWithProfile: jest.Mock };
  let addresses: { list: jest.Mock };
  let orders: { getStatsForUser: jest.Mock; listRecentForUser: jest.Mock };
  let service: AdminUserService;

  beforeEach(() => {
    users = { findByIdWithProfile: jest.fn() };
    addresses = { list: jest.fn().mockResolvedValue([]) };
    orders = {
      getStatsForUser: jest.fn().mockResolvedValue({
        totalOrders: 0,
        totalSpentCents: 0,
        byStatus: {},
      }),
      listRecentForUser: jest.fn().mockResolvedValue([]),
    };
    service = new AdminUserService(
      users as unknown as UserService,
      addresses as unknown as AddressService,
      orders as unknown as OrderService,
    );
  });

  it('composes user info + profile + addresses + stats + recent orders', async () => {
    users.findByIdWithProfile.mockResolvedValue({
      id: 'u1',
      email: 'jane@example.com',
      name: 'Jane',
      role: 'CUSTOMER',
      birthday: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      profile: { heightCm: 170, weightKg: 60, measurements: { chest: 90 } },
    });
    addresses.list.mockResolvedValue([{ id: 'a1' }]);
    orders.getStatsForUser.mockResolvedValue({
      totalOrders: 3,
      totalSpentCents: 4500,
      byStatus: { PAID: 2, DELIVERED: 1 },
    });
    orders.listRecentForUser.mockResolvedValue([{ id: 'o1' }]);

    const result = await service.getDetail('u1');

    expect(orders.listRecentForUser).toHaveBeenCalledWith('u1', 5);
    expect(result).toEqual(
      expect.objectContaining({
        id: 'u1',
        email: 'jane@example.com',
        name: 'Jane',
        role: 'CUSTOMER',
        profile: { heightCm: 170, weightKg: 60, measurements: { chest: 90 } },
        addresses: [{ id: 'a1' }],
        stats: { totalOrders: 3, totalSpentCents: 4500, byStatus: { PAID: 2, DELIVERED: 1 } },
        recentOrders: [{ id: 'o1' }],
      }),
    );
  });

  it('returns a null profile when the user has none', async () => {
    users.findByIdWithProfile.mockResolvedValue({
      id: 'u1',
      email: 'jane@example.com',
      name: null,
      role: 'CUSTOMER',
      birthday: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      profile: null,
    });

    const result = await service.getDetail('u1');
    expect(result.profile).toBeNull();
  });

  it('throws NotFound when the user does not exist', async () => {
    users.findByIdWithProfile.mockResolvedValue(null);
    await expect(service.getDetail('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(orders.getStatsForUser).not.toHaveBeenCalled();
  });
});
