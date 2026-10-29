import { Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SeedService } from './seed.service.js';

@ApiTags('Database Seeding')
@Controller('api/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @ApiOperation({ summary: 'Poblar la base de datos con comercios, categorías, productos reales, extras y pedido de prueba' })
  @ApiResponse({ status: 201, description: 'Datos insertados exitosamente en Supabase' })
  seedDatabase() {
    return this.seedService.seedAll();
  }
}
