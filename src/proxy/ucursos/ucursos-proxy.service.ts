import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import { UCursosAuthService } from './ucursos-auth.service';

@Injectable()
export class UCursosProxyService {
    private readonly logger = new Logger(UCursosProxyService.name);

    constructor(
        private httpService: HttpService,
        private authService: UCursosAuthService,
    ) {}

    async proxyRequest(path: string, method: string, body: any, headers: any, query: Record<string, string> = {}): Promise<any> {
        const cookies = await this.authService.getCookies();

        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === 'cookie') delete headers[key];
        }
        headers['cookie'] = cookies;
        if ('referer' in headers) {
            headers['referer'] = headers['referer'].replace('localhost:3000', 'www.u-cursos.cl');
        }
        if ('host' in headers) {
            headers['host'] = headers['host'].replace('localhost:3000', 'www.u-cursos.cl');
        }
        headers['Sec-GPC'] = '0';
        delete headers['if-none-match'];

        const normalizedPath = path.toString().replace(/,/g, '/');
        const queryString = new URLSearchParams(query).toString();
        const url = `https://www.u-cursos.cl/${normalizedPath}${queryString ? `?${queryString}` : ''}`;

        this.logger.debug(`Proxying ${method} ${url}`);
        this.logger.debug(`Request cookies: ${cookies}`);

        const config: AxiosRequestConfig = {
            method,
            url,
            headers: { ...headers },
            data: body,
            validateStatus: () => true,
        };

        const response = await firstValueFrom(
            this.httpService.request({
                ...config,
                httpsAgent: this.authService.httpsAgent,
            }),
        );

        this.logger.debug(`Response status: ${response.status}`);
        this.logger.debug(`Response set-cookie: ${JSON.stringify(response.headers['set-cookie'])}`);
        if (response.status !== 200) {
            this.logger.debug(`Response body (truncated): ${JSON.stringify(response.data).slice(0, 500)}`);
        }

        return response.data;
    }
}
