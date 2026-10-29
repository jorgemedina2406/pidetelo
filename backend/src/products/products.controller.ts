import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service.js';

@ApiTags('Products & Menu')
@Controller('api')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('tenants/:tenantId/products')
  @ApiOperation({ summary: 'Listar productos disponibles con sus grupos de modificadores y extras' })
  @ApiResponse({ status: 200, description: 'Catálogo de productos del comercio' })
  @ApiQuery({ name: 'branchId', required: false, description: 'ID de la sucursal específica' })
  @ApiQuery({ name: 'onlyAvailable', required: false, description: 'Filtrar solo productos disponibles (tienda cliente)' })
  findByTenant(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
    @Query('onlyAvailable') onlyAvailable?: string
  ) {
    const isOnlyAvailable = onlyAvailable === 'true';
    return this.productsService.findByTenant(tenantId, branchId, isOnlyAvailable);
  }

  @Post('tenants/:tenantId/branches/:branchId/copy-from-main')
  @ApiOperation({ summary: 'Copiar catálogo completo de la Sede Principal a una nueva sucursal' })
  copyFromMain(
    @Param('tenantId') tenantId: string,
    @Param('branchId') branchId: string
  ) {
    return this.productsService.copyFromMainBranch(tenantId, branchId);
  }

  @Get('tenants/:tenantId/categories')
  @ApiOperation({ summary: 'Listar categorías de productos de un comercio' })
  getCategories(@Param('tenantId') tenantId: string) {
    return this.productsService.getCategories(tenantId);
  }

  @Post('tenants/:tenantId/categories')
  @ApiOperation({ summary: 'Crear una nueva categoría de productos para el comercio' })
  createCategory(
    @Param('tenantId') tenantId: string,
    @Body() payload: { name: string; sort_order?: number }
  ) {
    return this.productsService.createCategory(tenantId, payload);
  }

  @Put('tenants/:tenantId/categories/:id')
  @ApiOperation({ summary: 'Actualizar una categoría de productos' })
  updateCategory(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() payload: { name?: string; sort_order?: number; is_active?: boolean }
  ) {
    return this.productsService.updateCategory(tenantId, id, payload);
  }

  @Delete('tenants/:tenantId/categories/:id')
  @ApiOperation({ summary: 'Eliminar una categoría de productos' })
  deleteCategory(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string
  ) {
    return this.productsService.deleteCategory(tenantId, id);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Obtener detalle de un producto específico' })
  findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Post('products')
  @ApiOperation({ summary: 'Crear un nuevo producto' })
  create(@Body() productData: any) {
    return this.productsService.create(productData);
  }

  @Post('tenants/:tenantId/products/bulk')
  @ApiOperation({ summary: 'Importación masiva de productos de un comercio (Excel / CSV)' })
  bulkImportByTenant(
    @Param('tenantId') tenantId: string,
    @Body() payload: { products: any[]; branchId?: string },
    @Query('branchId') queryBranchId?: string
  ) {
    const branchId = payload.branchId || queryBranchId;
    return this.productsService.bulkImport(tenantId, payload.products || [], branchId);
  }

  @Post('products/bulk')
  @ApiOperation({ summary: 'Importación masiva de productos (general)' })
  bulkImportGeneral(
    @Body() payload: { tenantId?: string; tenant_id?: string; branchId?: string; branch_id?: string; products: any[] },
    @Query('branchId') queryBranchId?: string
  ) {
    const tenantId = payload.tenantId || payload.tenant_id || '';
    const branchId = payload.branchId || payload.branch_id || queryBranchId;
    return this.productsService.bulkImport(tenantId, payload.products || [], branchId);
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Actualizar producto existente' })
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.productsService.update(id, updateData);
  }
}
