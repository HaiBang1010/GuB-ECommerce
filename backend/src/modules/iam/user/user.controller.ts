import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { MeResponseDto } from './dto/me-response.dto';
import { UserService } from './user.service';

// The signed-in user's own account. Authentication only (any role); the handler
// returns the caller's iam.User row. The frontend reads `role` from here as its
// single source of truth for showing admin UI — the backend RoleGuard on each
// admin endpoint is the real gate, so a wrong client-side guess can't bypass it.
@ApiTags('iam')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@UseGuards(SupabaseAuthGuard)
@Controller('me')
export class UserController {
  constructor(private readonly users: UserService) {}

  @ApiOperation({
    summary: 'Get the current user (id, email, role, basic profile)',
  })
  @ApiOkResponse({ type: MeResponseDto })
  @Get()
  async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponseDto> {
    // request.user carries only id/email/role; load the row for name/birthday
    // (and to reject a missing/archived account).
    const row = await this.users.assertActive(user.id);
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      name: row.name,
      birthday: row.birthday,
      createdAt: row.createdAt,
    };
  }
}
