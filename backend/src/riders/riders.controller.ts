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

  @Get('dispatch-pool')
  @ApiOperation({ summary: 'Obtener motorizados propios y de red cercana para asignación en comercios con filtros reales' })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'lng', required: false })
  @ApiQuery({ name: 'minRating', required: false })
  @ApiQuery({ name: 'maxDistanceKm', required: false })
  @ApiQuery({ name: 'minDeliveries', required: false })
  findDispatchPool(
    @Query('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('minRating') minRating?: string,
    @Query('maxDistanceKm') maxDistanceKm?: string,
    @Query('minDeliveries') minDeliveries?: string,
  ) {
    const numLat = lat ? parseFloat(lat) : undefined;
    const numLng = lng ? parseFloat(lng) : undefined;
    const numRating = minRating ? parseFloat(minRating) : undefined;
    const numMaxDist = maxDistanceKm ? parseFloat(maxDistanceKm) : undefined;
    const numMinDeliv = minDeliveries ? parseInt(minDeliveries, 10) : undefined;
    return this.ridersService.findDispatchPool(tenantId, branchId, numLat, numLng, numRating, numMaxDist, numMinDeliv);
  }

  @Post(':id/rate')
  @ApiOperation({ summary: 'Calificar servicio del motorizado por parte del cliente al completar entrega' })
  rateRider(
    @Param('id') riderId: string,
    @Body() body: { rating: number; orderId?: string; comment?: string },
  ) {
    return this.ridersService.rateRider(riderId, body.rating, body.orderId, body.comment);
  }

  @Post('register-with-verification')
  @ApiOperation({ summary: 'Registrar nuevo repartidor con verificación automática biométrica y de documento' })
  registerWithVerification(@Body() body: any) {
    return this.ridersService.registerWithVerification(body);
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
