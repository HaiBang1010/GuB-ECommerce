import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChatMessage } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { ChatThrottlerGuard } from './chat-throttler.guard';
import { ChatService, ChatThread } from './chat.service';
import { ChatMessageResponseDto } from './dto/chat-message-response.dto';
import { ChatThreadResponseDto } from './dto/chat-thread-response.dto';
import { MarkReadResponseDto } from './dto/mark-read-response.dto';
import { SendMessageDto } from './dto/send-message.dto';

// Customer support chat — one thread per user, always the caller's OWN (no id in
// the path, so cross-user access is structurally impossible). Persist-first: every
// message is written to Neon (source of truth); realtime is added in a later slice.
@ApiTags('chat')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@UseGuards(SupabaseAuthGuard)
@Controller('me/chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @ApiOperation({
    summary: 'Get (or create) my conversation with its message history',
  })
  @ApiOkResponse({ type: ChatThreadResponseDto })
  @Get()
  getThread(@CurrentUser() user: AuthenticatedUser): Promise<ChatThread> {
    return this.chat.getThreadForUser(user.id);
  }

  @ApiOperation({ summary: 'Send a message to support (persisted first)' })
  @ApiCreatedResponse({ type: ChatMessageResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Too many messages — slow down.' })
  @Throttle({ default: { limit: 5, ttl: 10_000 } })
  @UseGuards(ChatThrottlerGuard)
  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessage> {
    return this.chat.sendAsUser(user.id, dto.body);
  }

  @ApiOperation({
    summary: 'Mark the incoming (admin) messages in my conversation read',
  })
  @ApiOkResponse({ type: MarkReadResponseDto })
  @Post('read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MarkReadResponseDto> {
    return this.chat.markAdminMessagesRead(user.id);
  }
}
