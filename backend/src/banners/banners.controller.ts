import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { BannersService, Banner } from './banners.service.js';

@Controller(['api/banners', 'banners'])
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  findAll(@Query('all') all?: string): Promise<Banner[]> {
    const onlyActive = all !== 'true';
    return this.bannersService.findAll(onlyActive);
  }

  @Get(':id')
  findById(@Param('id') id: string): Promise<Banner> {
    return this.bannersService.findById(id);
  }

  @Post()
  create(@Body() payload: Partial<Banner>): Promise<Banner> {
    return this.bannersService.create(payload);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() payload: Partial<Banner>): Promise<Banner> {
    return this.bannersService.update(id, payload);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.bannersService.delete(id).then(success => ({ success }));
  }
}

