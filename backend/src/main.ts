import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody: true captures the unparsed request body alongside the parsed one —
  // the Stripe webhook needs the exact raw bytes to verify the signature.
  // logger ['error','warn'] silences the noisy per-route LOG output (route
  // mapping, instance loader) while keeping real errors and warnings.
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn'],
  });

  // The browser (Vercel) calls this API; allow cross-origin requests.
  app.enableCors();

  // Validate every incoming DTO; strip unknown properties.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // OpenAPI docs at GET /docs. Off in production by default; flip SWAGGER_ENABLED
  // to expose them anyway (e.g. portfolio demo). This only DOCUMENTS routes — it
  // does not touch the webhook's raw-body parsing.
  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('GuB API')
      .setDescription(
        'GuB e-commerce backend — modular monolith (auth, catalog, cart, orders, payments).',
      )
      .setVersion('0.1.0')
      // Supabase JWT for SupabaseAuthGuard + RolesGuard (most user/admin routes).
      .addBearerAuth()
      // Secret-header AdminGuard for machine/cron endpoints (/admin/jobs/*).
      .addApiKey(
        { type: 'apiKey', name: 'x-admin-secret', in: 'header' },
        'admin-secret',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // Render injects PORT; default to 3001 for local dev (frontend uses 3000).
  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  // One concise startup line (the verbose Nest LOG output is now suppressed).
  console.log(`🚀 GuB API: http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`📖 Docs:    http://localhost:${port}/docs`);
  }
}

void bootstrap();
