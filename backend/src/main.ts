import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
// AdminJS imports are loaded dynamically below inside a try/catch because
// some AdminJS packages have export/compatibility issues in certain Node
// environments. Loading them dynamically prevents startup crashes when the
// packages aren't available or are incompatible.
// AdminModule will initialize AdminJS; no direct AdminJS imports here.

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
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
