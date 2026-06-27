import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminUserDetailResponseDto } from './dto/admin-user-detail-response.dto';
import { PaginatedAdminUsersResponseDto } from './dto/admin-user-list-response.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { AdminUserDetail, AdminUserService } from './admin-user.service';
import { PaginatedAdminUsers } from './user.service';

// Admin customer management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('iam')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@ApiForbiddenResponse({ description: 'Requires ADMIN role.' })
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly adminUsers: AdminUserService) {}

  @ApiOperation({ summary: 'List customers, paginated (?search by name/email)' })
  @ApiOkResponse({ type: PaginatedAdminUsersResponseDto })
  @Get()
  list(@Query() query: ListUsersQueryDto): Promise<PaginatedAdminUsers> {
    return this.adminUsers.list({
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @ApiOperation({
    summary: 'Get a customer by id (profile + addresses + order stats + recent)',
  })
  @ApiOkResponse({ type: AdminUserDetailResponseDto })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @Get(':id')
  getOne(@Param('id') id: string): Promise<AdminUserDetail> {
    return this.adminUsers.getDetail(id);
  }
}
