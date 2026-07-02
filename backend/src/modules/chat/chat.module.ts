import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ChatAdminController } from './chat-admin.controller';
import { ChatController } from './chat.controller';
import { ChatThrottlerGuard } from './chat-throttler.guard';
import { ChatService } from './chat.service';

/**
 * Chat module — owns the `chat` schema (Conversation + ChatMessage). Persist-first:
 * every message is written to Neon here (the source of truth); the Supabase Realtime
 * Broadcast push layer is a later slice and never replaces persistence. Customer
 * identity for admin enrichment is resolved in-process via UserService (from the
 * global IamModule) — never a cross-schema JOIN. PrismaService is global too, so
 * this module imports neither. ThrottlerModule rate-limits the write endpoints (via
 * ChatThrottlerGuard, keyed on the authenticated user id). ChatService is exported
 * for the later offline-notification / realtime slices.
 */
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }])],
  controllers: [ChatController, ChatAdminController],
  providers: [ChatService, ChatThrottlerGuard],
  exports: [ChatService],
})
export class ChatModule {}
