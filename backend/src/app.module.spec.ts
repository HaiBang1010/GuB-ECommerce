import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

// Boot smoke test: compiles the full DI graph (every module, provider, controller
// and the global IamModule guards) without starting HTTP or touching the DB
// (PrismaService connects lazily). Catches wiring mistakes — a missing import,
// export or provider — that mocked unit tests cannot.
describe('AppModule (DI graph)', () => {
  it('compiles and resolves the whole container', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.close();
  });
});
