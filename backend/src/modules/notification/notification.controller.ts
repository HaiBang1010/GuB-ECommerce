import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Notification } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { MarkAllReadResponseDto } from './dto/notification-response.dto';
import { NotificationListResponseDto } from './dto/notification-list-response.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationList, NotificationService } from './notification.service';

// The signed-in user's own notifications. Authentication only (any role); every
// action is scoped to the caller's userId in the service.
@ApiTags('notification')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@UseGuards(SupabaseAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ summary: "List the current user's notifications + unread count" })
  @ApiOkResponse({ type: NotificationListResponseDto })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<NotificationList> {
    return this.notificationService.listForUser(user.id);
  }

  @ApiOperation({ summary: 'Mark a notification read' })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiNotFoundResponse({ description: 'Notification not found.' })
  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<Notification> {
    return this.notificationService.markRead(user.id, id);
  }

  @ApiOperation({ summary: "Mark all the user's notifications read" })
  @ApiOkResponse({ type: MarkAllReadResponseDto })
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    return this.notificationService.markAllRead(user.id);
  }
}
