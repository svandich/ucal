import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { UCursosAuthService } from './ucursos/ucursos-auth.service';
import { UCursosProxyService } from './ucursos/ucursos-proxy.service';
import { ICalService } from './ical/ical.service';
import { ProxyController, PROXY_HANDLERS } from './proxy.controller';

@Module({
    imports: [HttpModule, ConfigModule],
    controllers: [ProxyController],
    providers: [
        UCursosAuthService,
        UCursosProxyService,
        ICalService,
        {
            provide: PROXY_HANDLERS,
            useFactory: (icalService: ICalService) => [icalService],
            inject: [ICalService],
        },
    ],
})
export class ProxyModule {}
