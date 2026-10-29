import { Controller, Get, Post, Patch, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BranchesService } from './branches.service.js';

@ApiTags('Branches')
@Controller('api')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get('branches')
  @ApiOperation({ summary: 'Obtener todas las sucursales del sistema' })
  findAllBranches(
    @Query('companyId') companyId?: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.branchesService.findAll(companyId, onlyActive === 'true');
  }

  @Get('branches/pending')
  @ApiOperation({ summary: 'Obtener sucursales pendientes de aprobación para Super Admin' })
  findPendingBranches() {
    return this.branchesService.findPending();
  }

  @Get('branches/:id')
  @ApiOperation({ summary: 'Obtener una sucursal por ID' })
  findBranchById(@Param('id') id: string) {
    return this.branchesService.findById(id);
  }

  @Get('tenants/:companyId/branches')
  @ApiOperation({ summary: 'Obtener todas las sucursales de un comercio' })
  findBranchesByCompany(
    @Param('companyId') companyId: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.branchesService.findAll(companyId, onlyActive === 'true');
  }

  @Post('tenants/:companyId/branches')
  @ApiOperation({ summary: 'Registrar una nueva sucursal con coordenadas GPS y Pago Móvil propio' })
  createBranch(@Param('companyId') companyId: string, @Body() branchPayload: any) {
    return this.branchesService.create(companyId, branchPayload);
  }

  @Patch('branches/:id')
  @ApiOperation({ summary: 'Actualizar una sucursal existente (coordenadas, dirección, radio, etc.)' })
  updateBranch(@Param('id') id: string, @Body() branchPayload: any) {
    return this.branchesService.update(id, branchPayload);
  }

  @Put('branches/:id')
  @ApiOperation({ summary: 'Actualizar una sucursal existente (vía PUT)' })
  putBranch(@Param('id') id: string, @Body() branchPayload: any) {
    return this.branchesService.update(id, branchPayload);
  }

  @Delete('branches/:id')
  @ApiOperation({ summary: 'Eliminar una sucursal y todos sus datos asociados (solo Sede Principal / Super Admin)' })
  deleteBranch(
    @Param('id') id: string,
    @Query('role') role?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.branchesService.delete(id, role, branchId);
  }

  @Patch('branches/:id/toggle')
  @ApiOperation({ summary: 'Activar o pausar temporalmente una sucursal (Sede Principal o la misma Sucursal)' })
  toggleBranchStatus(
    @Param('id') id: string,
    @Body() body: { isOpen?: boolean; status?: string },
    @Query('role') role?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.branchesService.toggleStatus(id, body?.isOpen, body?.status, role, branchId);
  }

  @Patch('branches/:id/approve')
  @ApiOperation({ summary: 'Aprobar una sucursal (Super Admin)' })
  approveBranch(@Param('id') id: string, @Body() body: { approvedBy?: string }) {
    return this.branchesService.approve(id, body?.approvedBy);
  }

  @Patch('branches/:id/reject')
  @ApiOperation({ summary: 'Rechazar una sucursal con motivo (Super Admin)' })
  rejectBranch(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.branchesService.reject(id, body?.reason);
  }

  @Get('subscription-plans')
  @ApiOperation({ summary: 'Obtener los planes de suscripción disponibles' })
  getSubscriptionPlans() {
    return this.branchesService.getSubscriptionPlans();
  }
}
