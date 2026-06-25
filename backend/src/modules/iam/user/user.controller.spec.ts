import { NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { UserController } from './user.controller';
import { UserService } from './user.service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'u@example.com',
    name: null,
    role: 'CUSTOMER',
    birthday: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function principal(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return { id: 'u1', email: 'u@example.com', role: 'CUSTOMER', ...overrides };
}

describe('UserController', () => {
  let users: { assertActive: jest.Mock };
  let controller: UserController;

  beforeEach(() => {
    users = { assertActive: jest.fn() };
    controller = new UserController(users as unknown as UserService);
  });

  it('maps the current user to the response DTO (no extra fields leak)', async () => {
    users.assertActive.mockResolvedValue(
      makeUser({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'CUSTOMER' }),
    );

    await expect(controller.me(principal({ id: 'u1' }))).resolves.toEqual({
      id: 'u1',
      email: 'a@b.com',
      role: 'CUSTOMER',
      name: 'Alice',
      birthday: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(users.assertActive).toHaveBeenCalledWith('u1');
  });

  it('returns the DB role (ADMIN) — the row is the source of truth', async () => {
    // Even if the principal somehow claims CUSTOMER, the loaded row's role wins.
    users.assertActive.mockResolvedValue(makeUser({ id: 'admin1', role: 'ADMIN' }));

    const res = await controller.me(principal({ id: 'admin1', role: 'CUSTOMER' }));

    expect(res.role).toBe('ADMIN');
  });

  it('propagates NotFound when the account is missing or archived', async () => {
    users.assertActive.mockRejectedValue(new NotFoundException('User not found.'));

    await expect(controller.me(principal())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
