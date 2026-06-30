import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Banner } from '@prisma/client';
import { BannerResponseDto } from './dto/banner-response.dto';
import { MarketingService } from './marketing.service';

// Storefront banners — PUBLIC (no auth): the home page shows these to everyone,
// including guests (mirrors the public product reads).
@ApiTags('banner')
@Controller('banners')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @ApiOperation({ summary: 'List active home banners (public)' })
  @ApiOkResponse({ type: [BannerResponseDto] })
  @Get()
  list(): Promise<Banner[]> {
    return this.marketing.listActive();
  }
}
