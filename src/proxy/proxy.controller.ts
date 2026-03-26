import { Controller, Get, Inject, NotFoundException, Param, Headers, Query } from '@nestjs/common';
import { ProxyHandler } from './proxy-handler.interface';

export const PROXY_HANDLERS = 'PROXY_HANDLERS';

@Controller()
export class ProxyController {
    constructor(@Inject(PROXY_HANDLERS) private handlers: ProxyHandler[]) {}

    @Get('*path')
    async get(@Param('path') path: string, @Headers() headers: any, @Query() query: Record<string, string>) {
        const handler = this.handlers.find((h) => h.canHandle(path));
        if (!handler) throw new NotFoundException();
        return handler.handleRequest(path, 'GET', null, headers, query);
    }
}
