import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Address } from '@prisma/client';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

// The signed-in user's own address book. Authentication only (any role); every
// action is scoped to the caller's userId in the service.
@ApiTags('iam')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @ApiOperation({ summary: "List the current user's addresses" })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Address[]> {
    return this.addressService.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
  ): Promise<Address> {
    return this.addressService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<Address> {
    return this.addressService.update(user.id, id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<Address> {
    return this.addressService.archive(user.id, id);
  }

  @Post(':id/default')
  @HttpCode(HttpStatus.OK)
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<Address> {
    return this.addressService.setDefault(user.id, id);
  }
}
