import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { PlansService } from '../plans/plans.service.js';

@ApiTags('Orders & Comandas')
@Controller('api/orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly plansService: PlansService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo pedido desde el checkout del cliente' })
  @ApiResponse({ status: 201, description: 'Pedido creado exitosamente con sus items' })
  create(@Body() orderPayload: any) {
    return this.ordersService.create(orderPayload);
  }

  @Get('tenant/:tenantId')
  @ApiOperation({ summary: 'Listar pedidos de un comercio (para panel de cocina/despacho)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado: received, in_kitchen, on_the_way, delivered, cancelled' })
  @ApiQuery({ name: 'branchId', required: false, description: 'ID de la sucursal específica' })
  findByTenant(
    @Param('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.ordersService.findByTenant(tenantId, status, branchId);
  }

  @Get('driver/:driverId')
  @ApiOperation({ summary: 'Listar pedidos asignados a un repartidor específico' })
  findByDriver(@Param('driverId') driverId: string) {
    return this.ordersService.findByDriver(driverId);
  }

  @Get('fastest-route')
  @ApiOperation({ summary: 'Calcular la ruta vial más rápida entre dos coordenadas GPS' })
  getFastestRoute(
    @Query('originLat') originLat: number,
    @Query('originLng') originLng: number,
    @Query('destLat') destLat: number,
    @Query('destLng') destLng: number,
  ) {
    return this.ordersService.getFastestRoute(
      Number(originLat),
      Number(originLng),
      Number(destLat),
      Number(destLng),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de pedido para rastreo o comandas (por ID o número de orden)' })
  findById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Actualizar estado del pedido (received -> in_kitchen -> on_the_way -> delivered)' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.ordersService.updateStatus(id, status);
  }

  @Patch(':id/assign-rider')
  @ApiOperation({ summary: 'Asignar repartidor al pedido y ponerlo en camino' })
  assignRider(@Param('id') id: string, @Body('riderId') riderId: string) {
    return this.ordersService.assignRider(id, riderId);
  }

  @Get('export/:tenantId')
  @ApiOperation({ summary: 'Exportar reporte avanzado de pedidos a Excel (solo planes Pro y Franquicia)' })
  async exportOrders(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    await this.plansService.checkLimit(tenantId, 'excel');
    const orders = await this.ordersService.findByTenant(tenantId, undefined, branchId);
    return {
      success: true,
      count: orders.length,
      orders
    };
  }
  @Post(':id/append-items')
  @ApiOperation({ summary: 'Adicionar productos a un pedido antes de ser despachado' })
  appendItems(@Param('id') id: string, @Body('items') items: any[]) {
    return this.ordersService.appendItems(id, items);
  }

  @Post(':id/remove-item')
  @ApiOperation({ summary: 'Remover producto agotado del pedido y recalcular monto' })
  removeItem(
    @Param('id') id: string,
    @Body() payload: { itemId: string; productId?: string; disableProduct?: boolean },
  ) {
    return this.ordersService.removeItemFromOrder(id, payload);
  }
  @Post(':id/notify-stock-issue')
  @ApiOperation({ summary: 'Notificar al cliente por Bot de WhatsApp o WhatsApp Web y alerta in-app' })
  notifyStockIssue(
    @Param('id') id: string,
    @Body() payload: { productName: string; customMessage?: string },
  ) {
    return this.ordersService.notifyStockIssue(id, payload);
  }
}
