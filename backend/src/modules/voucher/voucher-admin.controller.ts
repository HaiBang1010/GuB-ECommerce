import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role, Voucher } from '@prisma/client';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { GrantVoucherDto } from './dto/grant-voucher.dto';
import { ListVouchersQueryDto } from './dto/list-vouchers-query.dto';
import { PaginatedVouchersResponseDto } from './dto/paginated-vouchers-response.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { VoucherResponseDto } from './dto/voucher-response.dto';
import { PaginatedVouchers, VoucherService } from './voucher.service';

// Admin voucher management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('voucher')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@ApiForbiddenResponse({ description: 'Requires ADMIN role.' })
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/vouchers')
export class VoucherAdminController {
  constructor(private readonly vouchers: VoucherService) {}

  @ApiOperation({ summary: 'Create a voucher' })
  @ApiCreatedResponse({ type: VoucherResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiConflictResponse({ description: 'A voucher with this code already exists.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateVoucherDto): Promise<Voucher> {
    return this.vouchers.create(dto);
  }

  @ApiOperation({ summary: 'List vouchers, paginated (?search by code)' })
  @ApiOkResponse({ type: PaginatedVouchersResponseDto })
  @Get()
  list(@Query() query: ListVouchersQueryDto): Promise<PaginatedVouchers> {
    return this.vouchers.listForAdmin({
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @ApiOperation({ summary: 'Get one voucher' })
  @ApiOkResponse({ type: VoucherResponseDto })
  @ApiNotFoundResponse({ description: 'Voucher not found.' })
  @Get(':id')
  getOne(@Param('id') id: string): Promise<Voucher> {
    return this.vouchers.getById(id);
  }

  @ApiOperation({ summary: 'Update a voucher' })
  @ApiOkResponse({ type: VoucherResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiConflictResponse({ description: 'A voucher with this code already exists.' })
  @ApiNotFoundResponse({ description: 'Voucher not found.' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVoucherDto,
  ): Promise<Voucher> {
    return this.vouchers.update(id, dto);
  }

  @ApiOperation({ summary: 'Archive a voucher (soft delete)' })
  @ApiOkResponse({ type: VoucherResponseDto })
  @ApiNotFoundResponse({ description: 'Voucher not found.' })
  @Delete(':id')
  archive(@Param('id') id: string): Promise<Voucher> {
    return this.vouchers.archive(id);
  }

  @ApiOperation({ summary: 'Grant a (wallet-only) voucher to a user' })
  @ApiOkResponse({ type: VoucherResponseDto })
  @ApiNotFoundResponse({ description: 'Voucher or user not found.' })
  @Post(':id/grant')
  @HttpCode(HttpStatus.OK)
  grant(
    @Param('id') id: string,
    @Body() dto: GrantVoucherDto,
  ): Promise<Voucher> {
    return this.vouchers.grant(id, dto.userId);
  }
}
