import { Controller, Get, Post, Param, Put, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TenantsService } from './tenants.service.js';

@ApiTags('Tenants')
@Controller('api/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todos los comercios (activos o todos si all=true)' })
  @ApiQuery({ name: 'all', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Lista de comercios' })
  findAll(@Query('all') all?: string) {
    return this.tenantsService.findAll(all === 'true');
  }

  @Post()
  @ApiOperation({ summary: 'Dar de alta un nuevo comercio y crear su usuario administrador' })
  create(@Body() payload: any) {
    return this.tenantsService.create(payload);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Obtener información de un comercio por su slug o ID' })
  findBySlug(@Param('slug') slug: string) {
    // Si parece UUID, buscamos por id, sino por slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    if (isUuid) {
      return this.tenantsService.findById(slug);
    }
    return this.tenantsService.findBySlug(slug);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar configuración o perfil del comercio' })
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.tenantsService.update(id, updateData);
  }
}
