import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { SupabaseAuthGuard } from '../../iam/auth/supabase-auth.guard';
import { SizeSuggestionResponseDto } from './dto/size-suggestion-response.dto';
import { SizeSuggestionService } from './size-suggestion.service';

// Rule-based size suggestion for the signed-in user on a product page. Auth required
// (it reads the caller's own measurements); the FE only calls it when logged in.
@ApiTags('product')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@UseGuards(SupabaseAuthGuard)
@Controller('products/:slug/size-suggestion')
export class SizeSuggestionController {
  constructor(private readonly suggestion: SizeSuggestionService) {}

  @ApiOperation({ summary: 'Suggested size for the current user (by product slug)' })
  @ApiOkResponse({ type: SizeSuggestionResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @Get()
  suggest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ): Promise<SizeSuggestionResponseDto> {
    return this.suggestion.suggest(slug, user.id);
  }
}
