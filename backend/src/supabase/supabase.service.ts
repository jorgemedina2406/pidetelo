import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL') || process.env.SUPABASE_URL;
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = this.configService.get<string>('SUPABASE_KEY') || process.env.SUPABASE_KEY;
    const key = serviceRoleKey || anonKey;

    if (!url || !key) {
      this.logger.error('SUPABASE_URL o SUPABASE_KEY no estan configurados en las variables de entorno.');
      throw new Error('Supabase configuration missing');
    }

    this.client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    if (serviceRoleKey) {
      this.logger.log(`Supabase client inicializado con clave administrativa (service_role - RLS Bypass) para: ${url}`);
    } else {
      this.logger.log(`Supabase client inicializado (anon key) para: ${url}`);
    }
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
