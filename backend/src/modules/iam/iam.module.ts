import { Global, Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { AddressController } from './address/address.controller';
import { AddressService } from './address/address.service';
import { OptionalSupabaseAuthGuard } from './auth/optional-supabase-auth.guard';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { SupabaseJwtService } from './auth/supabase-jwt.service';
import { AdminUserController } from './user/admin-user.controller';
import { AdminUserService } from './user/admin-user.service';
import { UserController } from './user/user.controller';
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
  // OrderModule (exports OrderService) powers the admin user-detail order stats.
  // Acyclic: OrderModule never imports the @Global IamModule.
  imports: [OrderModule],
  controllers: [AddressController, UserController, AdminUserController],
  providers: [
    UserService,
    AddressService,
    AdminUserService,
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
