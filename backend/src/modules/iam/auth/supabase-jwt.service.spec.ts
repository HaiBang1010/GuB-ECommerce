import { UnauthorizedException } from '@nestjs/common';
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
  type JWTVerifyGetKey,
} from 'jose';
import { SupabaseJwtService } from './supabase-jwt.service';

const ISSUER = 'https://test.supabase.co';
const KID = 'test-key';

// Exposes the JWKS seam so verification runs against a locally generated key
// pair instead of a remote endpoint.
class TestableJwtService extends SupabaseJwtService {
  constructor(private readonly localKeySet: JWTVerifyGetKey) {
    super();
  }

  protected getKeySet(): JWTVerifyGetKey {
    return this.localKeySet;
  }
}

type SignOptions = {
  issuer?: string;
  audience?: string;
  expiration?: string | number | Date;
};

describe('SupabaseJwtService', () => {
  let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
  let getKey: JWTVerifyGetKey;
  let service: TestableJwtService;

  beforeAll(async () => {
    keyPair = await generateKeyPair('RS256');
    const jwk: JWK = await exportJWK(keyPair.publicKey);
    jwk.kid = KID;
    jwk.alg = 'RS256';
    getKey = createLocalJWKSet({ keys: [jwk] });
  });

  beforeEach(() => {
    process.env.SUPABASE_URL = ISSUER;
    service = new TestableJwtService(getKey);
  });

  afterAll(() => {
    delete process.env.SUPABASE_URL;
  });

  function sign(
    payload: Record<string, unknown>,
    opts: SignOptions = {},
  ): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuedAt()
      .setIssuer(opts.issuer ?? `${ISSUER}/auth/v1`)
      .setAudience(opts.audience ?? 'authenticated')
      .setExpirationTime(opts.expiration ?? '1h')
      .sign(keyPair.privateKey);
  }

  it('verifies a valid token and extracts identity claims', async () => {
    const token = await sign({
      sub: 'uuid-1',
      email: 'a@b.com',
      user_metadata: { name: 'Alice' },
    });
    await expect(service.verify(token)).resolves.toEqual({
      sub: 'uuid-1',
      email: 'a@b.com',
      name: 'Alice',
    });
  });

  it('falls back to full_name, then null, for the display name', async () => {
    const withFullName = await sign({
      sub: 'uuid-1',
      email: 'a@b.com',
      user_metadata: { full_name: 'Full Name' },
    });
    await expect(service.verify(withFullName)).resolves.toMatchObject({
      name: 'Full Name',
    });

    const withoutName = await sign({ sub: 'uuid-1', email: 'a@b.com' });
    await expect(service.verify(withoutName)).resolves.toMatchObject({
      name: null,
    });
  });

  it('rejects an expired token', async () => {
    const token = await sign(
      { sub: 'uuid-1', email: 'a@b.com' },
      { expiration: new Date(Date.now() - 60_000) },
    );
    await expect(service.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token from the wrong issuer', async () => {
    const token = await sign(
      { sub: 'uuid-1', email: 'a@b.com' },
      { issuer: 'https://evil.example/auth/v1' },
    );
    await expect(service.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await sign(
      { sub: 'uuid-1', email: 'a@b.com' },
      { audience: 'service_role' },
    );
    await expect(service.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token missing the subject', async () => {
    const token = await sign({ email: 'a@b.com' });
    await expect(service.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token signed by an unknown key', async () => {
    const stranger = await generateKeyPair('RS256');
    const token = await new SignJWT({ sub: 'uuid-1', email: 'a@b.com' })
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuedAt()
      .setIssuer(`${ISSUER}/auth/v1`)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(stranger.privateKey);
    await expect(service.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
