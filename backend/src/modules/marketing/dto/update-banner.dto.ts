import { PartialType } from '@nestjs/swagger';
import { CreateBannerDto } from './create-banner.dto';

// All fields optional on update (mirrors UpdateVoucherDto). Validators carry over.
export class UpdateBannerDto extends PartialType(CreateBannerDto) {}
