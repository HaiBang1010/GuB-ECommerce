import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChatMessage, Role } from '@prisma/client';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { ChatThrottlerGuard } from './chat-throttler.guard';
import {
  ChatService,
  ChatThread,
  PaginatedAdminConversations,
} from './chat.service';
import { ChatMessageResponseDto } from './dto/chat-message-response.dto';
import { ChatThreadResponseDto } from './dto/chat-thread-response.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { MarkReadResponseDto } from './dto/mark-read-response.dto';
import { PaginatedAdminConversationsResponseDto } from './dto/paginated-admin-conversations-response.dto';
import { SendMessageDto } from './dto/send-message.dto';

// Admin inbox — Supabase JWT + ADMIN role (backend-enforced, not UI-only). Reads
// any customer's conversation; enriches identity in-process via UserService.
@ApiTags('chat')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@ApiForbiddenResponse({ description: 'Requires ADMIN role.' })
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/chat')
export class ChatAdminController {
  constructor(private readonly chat: ChatService) {}

  @ApiOperation({
    summary: 'List conversations, paginated (?search by customer name/email)',
  })
  @ApiOkResponse({ type: PaginatedAdminConversationsResponseDto })
  @Get('conversations')
  list(
    @Query() query: ListConversationsQueryDto,
  ): Promise<PaginatedAdminConversations> {
    return this.chat.listConversationsForAdmin({
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @ApiOperation({ summary: 'Get one conversation with its message history' })
  @ApiOkResponse({ type: ChatThreadResponseDto })
  @ApiNotFoundResponse({ description: 'Conversation not found.' })
  @Get('conversations/:id')
  getOne(@Param('id') id: string): Promise<ChatThread> {
    return this.chat.getConversationForAdmin(id);
  }

  @ApiOperation({ summary: 'Reply to a conversation as admin (persisted first)' })
  @ApiCreatedResponse({ type: ChatMessageResponseDto })
  @ApiNotFoundResponse({ description: 'Conversation not found.' })
  @ApiTooManyRequestsResponse({ description: 'Too many messages — slow down.' })
  @Throttle({ default: { limit: 5, ttl: 10_000 } })
  @UseGuards(ChatThrottlerGuard)
  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  reply(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessage> {
    return this.chat.sendAsAdmin(id, dto.body);
  }

  @ApiOperation({
    summary: "Mark a conversation's incoming (customer) messages read",
  })
  @ApiOkResponse({ type: MarkReadResponseDto })
  @ApiNotFoundResponse({ description: 'Conversation not found.' })
  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  markRead(@Param('id') id: string): Promise<MarkReadResponseDto> {
    return this.chat.markUserMessagesRead(id);
  }
}
