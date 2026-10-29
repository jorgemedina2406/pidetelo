import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UsersService, CreateStoreUserDto } from './users.service.js';

@ApiTags('Store Users')
@Controller('api')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('tenants/:tenantId/users')
  @ApiOperation({ summary: 'Obtener todos los colaboradores de un comercio (filtrable por branchId)' })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  findAllForTenant(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.usersService.findAll(tenantId, branchId);
  }

  @Post('tenants/:tenantId/users')
  @ApiOperation({ summary: 'Crear un nuevo colaborador para el comercio y asignarlo a una sucursal' })
  createForTenant(
    @Param('tenantId') tenantId: string,
    @Body() payload: any,
  ) {
    return this.usersService.create(tenantId, payload);
  }

  @Put('tenants/:tenantId/users/:id')
  @ApiOperation({ summary: 'Actualizar rol, sucursal o datos de un colaborador' })
  updateForTenant(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() payload: any,
  ) {
    return this.usersService.update(id, payload);
  }

  @Delete('tenants/:tenantId/users/:id')
  @ApiOperation({ summary: 'Eliminar o dar de baja a un colaborador del comercio' })
  deleteForTenant(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.usersService.delete(id);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Obtener información de un usuario por su ID' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post('users/login')
  @ApiOperation({ summary: 'Iniciar sesión para colaboradores y encargados de sucursal' })
  login(@Body() body: { email: string; password?: string }) {
    return this.usersService.login(body.email, body.password);
  }
}
