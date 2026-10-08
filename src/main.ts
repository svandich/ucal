import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Let browsers read the calendars from other sites (e.g. a WordPress page).
  // CORS_ORIGIN can limit this to a comma-separated list of origins.
  const origins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins?.length ? origins : '*', methods: ['GET'] });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
