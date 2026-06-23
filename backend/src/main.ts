import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // The browser (Vercel) calls this API; allow cross-origin requests.
  app.enableCors();

  // Validate every incoming DTO; strip unknown properties.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Render injects PORT; default to 3001 for local dev (frontend uses 3000).
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

void bootstrap();
