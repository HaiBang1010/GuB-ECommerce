import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper around PrismaClient so modules can inject a single shared client.
 *
 * Connection is LAZY on purpose (no $connect() in onModuleInit): Prisma opens a
 * connection on the first query. This lets the app — and the DB-free GET /health
 * endpoint — boot even without a DATABASE_URL, which is what Phase 0 needs.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
