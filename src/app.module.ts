import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,
    ProxyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
