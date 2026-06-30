import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Profile } from '@prisma/client';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserService } from '../user/user.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

// The signed-in user's own body profile (height/weight/measurements + birthday).
// Authentication only (any role); every action is scoped to the caller's userId.
// `birthday` lives on iam.User (it also drives the birthday-voucher cron), so the
// controller composes ProfileService (measurements) with UserService (birthday) —
// both iam-owned, in-process. ProfileService stays Profile-only (the size suggestion
// still reads it untouched).
@ApiTags('iam')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@UseGuards(SupabaseAuthGuard)
@Controller('me/profile')
export class ProfileController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly users: UserService,
  ) {}

  @ApiOperation({ summary: "Get the current user's profile (measurements + birthday)" })
  @ApiOkResponse({ type: ProfileResponseDto })
  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponseDto> {
    return this.buildResponse(user.id);
  }

  @ApiOperation({
    summary: "Update the current user's profile (measurements + birthday)",
  })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @Patch()
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    await this.profiles.update(user.id, dto);
    if (dto.birthday !== undefined) {
      await this.users.setBirthday(user.id, dto.birthday);
    }
    return this.buildResponse(user.id);
  }

  // Read the measurements (Profile) + birthday (User) and map to the response. Both
  // reads stay within the iam schema (no cross-schema JOIN).
  private async buildResponse(userId: string): Promise<ProfileResponseDto> {
    const [profile, user] = await Promise.all([
      this.profiles.getByUserId(userId),
      this.users.findById(userId),
    ]);
    return toResponse(profile, user?.birthday ?? null);
  }
}

// Map the Profile row (or null) + birthday to the response shape, narrowing the JSON column.
function toResponse(
  profile: Profile | null,
  birthday: Date | null,
): ProfileResponseDto {
  if (!profile) {
    return { heightCm: null, weightKg: null, measurements: null, birthday };
  }
  return {
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    measurements:
      profile.measurements === null
        ? null
        : (profile.measurements as Record<string, unknown>),
    birthday,
  };
}
