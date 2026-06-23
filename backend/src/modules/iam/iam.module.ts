import { Global, Module } from '@nestjs/common';
import { AddressController } from './address/address.controller';
import { AddressService } from './address/address.service';
import { OptionalSupabaseAuthGuard } from './auth/optional-supabase-auth.guard';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { SupabaseJwtService } from './auth/supabase-jwt.service';
import { UserService } from './user/user.service';

/**
 * Identity & access module. Owns the `iam` schema (User/Profile/Address) and the
 * Supabase JWT authentication path.
 *
 * @Global because auth is cross-cutting: SupabaseAuthGuard guards endpoints
 * across every feature module, and UserService is the in-process entry point
 * siblings (cart/order/review) use to resolve a userId — same rationale as the
 * global PrismaModule. Avoids re-importing IamModule everywhere.
 */
@Global()
@Module({
  controllers: [AddressController],
  providers: [
    UserService,
    AddressService,
    SupabaseJwtService,
    SupabaseAuthGuard,
    OptionalSupabaseAuthGuard,
  ],
  exports: [
    UserService,
    AddressService,
    SupabaseJwtService,
    SupabaseAuthGuard,
    OptionalSupabaseAuthGuard,
  ],
})
export class IamModule {}
