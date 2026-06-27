import { PartialType } from '@nestjs/swagger';
import { CreateVoucherDto } from './create-voucher.dto';

// All fields optional; the same cross-field rules are re-checked in VoucherService
// against the merged (existing + patch) values.
export class UpdateVoucherDto extends PartialType(CreateVoucherDto) {}
