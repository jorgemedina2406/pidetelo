import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { ProductsModule } from './products/products.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { RidersModule } from './riders/riders.module.js';
import { BranchesModule } from './branches/branches.module.js';
import { UsersModule } from './users/users.module.js';
import { SeedModule } from './seed/seed.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    TenantsModule,
    ProductsModule,
    OrdersModule,
    RidersModule,
    BranchesModule,
    UsersModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
