import { Controller, Post, Get, Param, Body, Res, Req, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service.js';

@Controller(['api/uploads', 'uploads'])
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);
  private uploadsDir = path.join(process.cwd(), 'uploads');

  constructor(private readonly supabase: SupabaseService) {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  @Post()
  async uploadImage(@Body() body: { data: string; filename?: string }, @Req() req: Request) {
    if (!body || !body.data) {
      throw new BadRequestException('Se requiere el campo "data" con la imagen en base64');
    }

    const matches = body.data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    let buffer: Buffer;
    let ext = 'webp';
    let mime = 'image/webp';

    if (matches && matches.length === 3) {
      mime = matches[1];
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('gif')) ext = 'gif';
      else if (mime.includes('svg')) ext = 'svg';
      else ext = 'jpg';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(body.data, 'base64');
    }

    const filePrefix = body.filename ? path.basename(body.filename, path.extname(body.filename)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24) : 'asset';
    const fileId = `${filePrefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(this.uploadsDir, fileId);

    // 1. Guardar copia local en uploads/
    fs.writeFileSync(filePath, buffer);

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const localUrl = `${protocol}://${host}/api/uploads/${fileId}`;

    // 2. Subir directamente a Supabase Storage (bucket 'merchant-assets')
    let storageUrl: string | null = null;
    try {
      const client = this.supabase.getClient();
      const bucketName = 'merchant-assets';

      const { data: uploadData, error: uploadErr } = await client.storage
        .from(bucketName)
        .upload(fileId, buffer, {
          contentType: mime,
          upsert: true,
        });

      if (!uploadErr && uploadData) {
        const { data: pubData } = client.storage.from(bucketName).getPublicUrl(fileId);
        if (pubData?.publicUrl) {
          storageUrl = pubData.publicUrl;
          this.logger.log(`[UploadsController] Archivo subido exitosamente a Supabase Storage: ${storageUrl}`);
        }
      } else if (uploadErr) {
        this.logger.warn(`[UploadsController] Aviso en Supabase Storage: ${uploadErr.message}`);
        if (uploadErr.message?.includes('not found') || (uploadErr as any).statusCode === '404') {
          await client.storage.createBucket(bucketName, { public: true });
          const retry = await client.storage.from(bucketName).upload(fileId, buffer, { contentType: mime, upsert: true });
          if (retry.data) {
            storageUrl = client.storage.from(bucketName).getPublicUrl(fileId).data.publicUrl;
            this.logger.log(`[UploadsController] Bucket creado y archivo subido a Supabase Storage: ${storageUrl}`);
          }
        }
      }
    } catch (sErr: any) {
      this.logger.warn(`[UploadsController] Error conectando a Supabase Storage: ${sErr.message}`);
    }

    const finalUrl = storageUrl || localUrl;

    return {
      success: true,
      filename: fileId,
      url: finalUrl,
      storageUrl,
      localUrl
    };
  }

  @Get(':filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.uploadsDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Archivo no encontrado');
    }

    const ext = path.extname(safeFilename).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}

