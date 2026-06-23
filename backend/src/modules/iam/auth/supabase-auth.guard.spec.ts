import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseJwtService } from './supabase-jwt.service';
import { UserService } from '../user/user.service';

interface TestRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: { id: string; email: string; role: string };
}

function makeContext(headers: Record<string, string | string[] | undefined>): {
  context: ExecutionContext;
  request: TestRequest;
} {
  const request: TestRequest = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('SupabaseAuthGuard', () => {
  let jwt: { verify: jest.Mock };
  let users: { upsertOnLogin: jest.Mock };
  let guard: SupabaseAuthGuard;

  beforeEach(() => {
    jwt = { verify: jest.fn() };
    users = { upsertOnLogin: jest.fn() };
    guard = new SupabaseAuthGuard(
      jwt as unknown as SupabaseJwtService,
      users as unknown as UserService,
    );
  });

  it('verifies the token, upserts the user, and attaches request.user', async () => {
    jwt.verify.mockResolvedValue({ sub: 'u1', email: 'a@b.com', name: 'Alice' });
    users.upsertOnLogin.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'ADMIN',
    });
    const { context, request } = makeContext({ authorization: 'Bearer tok' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwt.verify).toHaveBeenCalledWith('tok');
    expect(users.upsertOnLogin).toHaveBeenCalledWith({
      sub: 'u1',
      email: 'a@b.com',
      name: 'Alice',
    });
    // Role comes from the DB row, not the token.
    expect(request.user).toEqual({ id: 'u1', email: 'a@b.com', role: 'ADMIN' });
  });

  it('rejects a missing Authorization header without verifying', async () => {
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('rejects a non-Bearer scheme', async () => {
    const { context } = makeContext({ authorization: 'Basic abc' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('propagates a verification failure and never upserts', async () => {
    jwt.verify.mockRejectedValue(
      new UnauthorizedException('Invalid or expired token.'),
    );
    const { context } = makeContext({ authorization: 'Bearer bad' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(users.upsertOnLogin).not.toHaveBeenCalled();
  });
});
