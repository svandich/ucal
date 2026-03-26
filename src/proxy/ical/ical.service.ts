import { Injectable } from '@nestjs/common';
import { UCursosProxyService } from '../ucursos/ucursos-proxy.service';
import { ProxyHandler } from '../proxy-handler.interface';

// Matches: /:faculty/:year/:semester/:courseCode/:section/calendario/ical
// e.g.   : /ingenieria/2026/1/FI2004/1/calendario/ical
const ICAL_PATH_PATTERN = /^[^/]+\/\d+\/\d+\/[^/]+\/\d+\/calendario\/ical$/;

@Injectable()
export class ICalService implements ProxyHandler {
    constructor(private proxyService: UCursosProxyService) {}

    canHandle(path: string): boolean {
        return ICAL_PATH_PATTERN.test(path.toString().replace(/,/g, '/'));
    }

    handleRequest(path: string, method: string, body: any, headers: any, query: Record<string, string> = {}): Promise<any> {
        return this.proxyService.proxyRequest(path, method, body, headers, query);
    }
}
