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
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

// The signed-in user's own body profile (height/weight/measurements). Authentication
// only (any role); every action is scoped to the caller's userId.
@ApiTags('iam')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@UseGuards(SupabaseAuthGuard)
@Controller('me/profile')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @ApiOperation({ summary: "Get the current user's profile (measurements)" })
  @ApiOkResponse({ type: ProfileResponseDto })
  @Get()
  async get(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProfileResponseDto> {
    const profile = await this.profiles.getByUserId(user.id);
    return toResponse(profile);
  }

  @ApiOperation({ summary: "Update the current user's profile (measurements)" })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @Patch()
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const profile = await this.profiles.update(user.id, dto);
    return toResponse(profile);
  }
}

// Map the Profile row (or null) to the response shape, narrowing the JSON column.
function toResponse(profile: Profile | null): ProfileResponseDto {
  if (!profile) {
    return { heightCm: null, weightKg: null, measurements: null };
  }
  return {
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    measurements:
      profile.measurements === null
        ? null
        : (profile.measurements as Record<string, unknown>),
  };
}
