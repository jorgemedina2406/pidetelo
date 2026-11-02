import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';

@Controller(['api/categories', 'categories'])
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async getCategories(@Query('includeInactive') includeInactive?: string) {
    const shouldInclude = includeInactive === 'true';
    return this.categoriesService.findAll(shouldInclude);
  }

  @Post()
  async createCategory(@Body() payload: any) {
    return this.categoriesService.create(payload);
  }

  @Patch(':id')
  async updateCategory(@Param('id') id: string, @Body() payload: any) {
    return this.categoriesService.update(id, payload);
  }

  @Delete(':id')
  async deleteCategory(@Param('id') id: string) {
    return { success: await this.categoriesService.delete(id) };
  }
}

