import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { RidersService } from './riders.service.js';

@ApiTags('Riders & GPS Telemetry')
@Controller('api/riders')
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar repartidores' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.ridersService.findAll(tenantId, branchId);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar nuevo repartidor con credenciales' })
  create(
    @Body()
    body: {
      tenant_id?: string;
      branch_id?: string;
      name: string;
      email?: string;
      password?: string;
      phone: string;
      vehicle_plate: string;
      vehicle_type?: string;
      national_id?: string;
    },
  ) {
    return this.ridersService.create(body);
  }

  @Post('login')
  @ApiOperation({ summary: 'Autenticar repartidor con correo o usuario y contraseña' })
  login(
    @Body()
    body: {
      email: string;
      password: string;
    },
  ) {
    return this.ridersService.login(body.email, body.password);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener datos de un repartidor' })
  findById(@Param('id') id: string) {
    return this.ridersService.findById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar repartidor de la sucursal' })
  delete(
    @Param('id') id: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.ridersService.delete(id, branchId);
  }

  @Post(':id/location')
  @ApiOperation({ summary: 'Actualizar ubicación GPS del repartidor' })
  updateLocation(
    @Param('id') id: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.ridersService.updateLocation(id, body.lat, body.lng);
  }

  @Post(':id/profile')
  @ApiOperation({ summary: 'Actualizar perfil completo del repartidor' })
  updateProfile(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.ridersService.updateProfile(id, body);
  }

  @Post('telemetry')
  @ApiOperation({ summary: 'Registrar paquete de telemetría GPS en tiempo real' })
  saveTelemetry(
    @Body()
    telemetry: {
      rider_id: string;
      order_id?: string;
      latitude: number;
      longitude: number;
      speed_kmh?: number;
      heading?: number;
      battery_level?: number;
    },
  ) {
    return this.ridersService.saveTelemetry(telemetry);
  }

  @Get('orders/:orderId/telemetry')
  @ApiOperation({ summary: 'Consultar historial de telemetría de un pedido para la ruta en el mapa' })
  getOrderTelemetry(@Param('orderId') orderId: string) {
    return this.ridersService.getOrderTelemetry(orderId);
  }
}
