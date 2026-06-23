import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AuthenticatedUser } from './authenticated-user';

const ADMIN: AuthenticatedUser = { id: 'u1', email: 'a@b.com', role: 'ADMIN' };
const CUSTOMER: AuthenticatedUser = { id: 'u2', email: 'c@d.com', role: 'CUSTOMER' };

function makeContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext(CUSTOMER))).toBe(true);
  });

  it('allows access when the required-roles list is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('allows a user whose role is permitted', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(guard.canActivate(makeContext(ADMIN))).toBe(true);
  });

  it('forbids a user whose role is not permitted', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeContext(CUSTOMER))).toThrow(
      ForbiddenException,
    );
  });

  it('forbids when there is no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
