import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import { UCursosAuthService } from './ucursos-auth.service';

@Injectable()
export class UCursosProxyService {
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
        headers['host'] = 'www.u-cursos.cl';
        if ('referer' in headers) {
            try {
                const ref = new URL(headers['referer']);
                ref.host = 'www.u-cursos.cl';
                ref.protocol = 'https:';
                headers['referer'] = ref.toString();
            } catch {
                headers['referer'] = 'https://www.u-cursos.cl/';
            }
        }
        headers['Sec-GPC'] = '0';
        delete headers['if-none-match'];

        const normalizedPath = path.toString().replace(/,/g, '/');
        const queryString = new URLSearchParams(query).toString();
        const url = `https://www.u-cursos.cl/${normalizedPath}${queryString ? `?${queryString}` : ''}`;

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
        return response.data;
    }
}
