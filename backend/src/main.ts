import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import type { Express } from 'express';
import { join } from 'node:path';
// AdminJS imports are loaded dynamically below inside a try/catch because
// some AdminJS packages have export/compatibility issues in certain Node
// environments. Loading them dynamically prevents startup crashes when the
// packages aren't available or are incompatible.
// AdminModule will initialize AdminJS; no direct AdminJS imports here.

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    bodyParser: false,
  });
  // We disabled Nest's global body parser so AdminJS can use its own
  // multipart/form-data parser (formidable) on the admin routes. Re-enable
  // JSON/urlencoded parsing for our API namespace only so the rest of the
  // application continues to work as before.
  const expressInstance = app.getHttpAdapter().getInstance() as Express;
  // Dynamically import express so TypeScript can type the instance safely.
  const expressModule = await import('express');

  const expressApp: any = expressModule.default ?? expressModule;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
  expressInstance.use('/api', expressApp.json());
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
  expressInstance.use('/api', expressApp.urlencoded({ extended: true }));
  // Serve uploaded media statically
  expressInstance.use(
    '/uploads',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    expressApp.static(join(process.cwd(), 'uploads')),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Use Nest's ClassSerializerInterceptor to honor class-transformer decorators on DTOs
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  const config = new DocumentBuilder()
    .setTitle('BabblinGo API')
    .setDescription('API docs for BabblinGo backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // AdminJS is initialized by the AdminModule during bootstrap.

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
