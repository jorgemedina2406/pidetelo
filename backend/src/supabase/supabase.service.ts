import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;
  private supabaseUrl: string;
  private authVerifyKey: string;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL') || process.env.SUPABASE_URL;
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = this.configService.get<string>('SUPABASE_KEY') || process.env.SUPABASE_KEY;
    const key = serviceRoleKey || anonKey;

    if (!url || !key) {
      this.logger.error('SUPABASE_URL o SUPABASE_KEY no estan configurados en las variables de entorno.');
      throw new Error('Supabase configuration missing');
    }

    this.supabaseUrl = url;
    this.authVerifyKey = anonKey || key;

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

  async verifyUserCredentials(email: string, password: string): Promise<{ id: string; email: string } | null> {
    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail || !password) return null;
    try {
      const tempClient = createClient(this.supabaseUrl, this.authVerifyKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      const { data, error } = await tempClient.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error || !data?.user?.id) {
        return null;
      }
      return {
        id: data.user.id,
        email: (data.user.email || cleanEmail).toLowerCase().trim(),
      };
    } catch (_) {
      return null;
    }
  }
}
