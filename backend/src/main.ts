import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS for Angular frontend
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 2. Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 3. Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Delivery Platform API')
    .setDescription('Backend REST API para plataforma Multi-Tenant de Delivery, Pedidos, Cocina y Telemetría GPS')
    .setVersion('1.0')
    .addTag('Tenants', 'Gestión de comercios y restaurantes')
    .addTag('Products & Menu', 'Catálogo de productos y personalizadores')
    .addTag('Orders & Comandas', 'Creación y seguimiento de pedidos')
    .addTag('Riders & GPS Telemetry', 'Flota de repartidores y rastreo en vivo')
    .addTag('Database Seeding', 'Poblar base de datos con datos de prueba')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 Servidor Backend iniciado en: http://localhost:${port}`);
  logger.log(`📚 Documentación Swagger interactiva en: http://localhost:${port}/api/docs`);
}

await bootstrap();
