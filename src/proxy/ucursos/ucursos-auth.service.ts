import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';

const COOKIE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const AUTH_API_URL = 'https://www.u-cursos.cl/auth/api';
const HOME_URL = 'https://www.u-cursos.cl/';

@Injectable()
export class UCursosAuthService {
    private cachedCookies: string | null = null;
    private cookiesSetAt: number | null = null;

    readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

    constructor(
        private httpService: HttpService,
        private configService: ConfigService,
    ) {}

    async getCookies(): Promise<string> {
        const now = Date.now();
        if (
            this.cachedCookies &&
            this.cookiesSetAt !== null &&
            now - this.cookiesSetAt < COOKIE_TTL_MS
        ) {
            return this.cachedCookies;
        }
        this.cachedCookies = await this.login();
        this.cookiesSetAt = Date.now();
        return this.cachedCookies;
    }

    private async login(): Promise<string> {
        const username = this.configService.get<string>('UCURSOS_USER') ?? '';
        const password = this.configService.get<string>('UCURSOS_PASS') ?? '';

        // Step 1: GET home page to obtain session cookies
        const homeResponse = await firstValueFrom(
            this.httpService.get(HOME_URL, {
                httpsAgent: this.httpsAgent,
                validateStatus: () => true,
                maxRedirects: 5,
            }),
        );

        const initialCookies = this.extractCookies(homeResponse.headers['set-cookie']);
        const cookieMap = this.parseCookieString(initialCookies);

        // _sess and _LB are embedded in the up.js script URL in the HTML, not in cookies
        const html = homeResponse.data as string;
        const upJsMatch = /auth\/up\.js\?([^"']+)/.exec(html);
        const upJsParams = new URLSearchParams(upJsMatch?.[1] ?? '');
        const sess = upJsParams.get('_sess') ?? '';
        const lb = upJsParams.get('_LB') ?? cookieMap.get('_LB') ?? '';

        // Step 2: POST credentials to /auth/api
        const formData = new URLSearchParams({
            servicio: 'ucursos',
            debug: '0',
            _sess: sess,
            _LB: lb,
            lang: 'es',
            username,
            password,
            recordar: '1',
        });

        const authResponse = await firstValueFrom(
            this.httpService.post(AUTH_API_URL, formData.toString(), {
                httpsAgent: this.httpsAgent,
                validateStatus: () => true,
                maxRedirects: 5,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Cookie: initialCookies,
                    Referer: HOME_URL,
                },
            }),
        );

        const authCookies = this.extractCookies(authResponse.headers['set-cookie']);
        const cookiesAfterAuth = this.mergeCookies(initialCookies, authCookies);

        // Step 3: follow the redirect chain manually to collect cookies at each hop
        const redirectUrl: string = authResponse.data?.u;
        if (!redirectUrl) throw new Error('[login] No redirect URL in auth response');

        let currentUrl = redirectUrl;
        let currentCookies = cookiesAfterAuth;

        for (let i = 0; i < 5; i++) {
            const resp = await firstValueFrom(
                this.httpService.get(currentUrl, {
                    httpsAgent: this.httpsAgent,
                    validateStatus: () => true,
                    maxRedirects: 0,
                    headers: {
                        Cookie: currentCookies,
                        Referer: AUTH_API_URL,
                    },
                }),
            );

            const hopCookies = this.extractCookies(resp.headers['set-cookie']);
            currentCookies = this.mergeCookies(currentCookies, hopCookies);

            if (resp.status >= 300 && resp.status < 400 && resp.headers['location']) {
                const loc = resp.headers['location'] as string;
                currentUrl = loc.startsWith('http') ? loc : `https://www.u-cursos.cl${loc}`;
            } else {
                break;
            }
        }

        return currentCookies;
    }

    private extractCookies(setCookieHeaders: string[] | string | undefined): string {
        if (!setCookieHeaders) return '';
        const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        return headers
            .map((h) => h.split(';')[0].trim())
            .filter(Boolean)
            .join('; ');
    }

    private parseCookieString(cookieStr: string): Map<string, string> {
        const map = new Map<string, string>();
        for (const pair of cookieStr.split('; ')) {
            const eqIdx = pair.indexOf('=');
            if (eqIdx === -1) continue;
            map.set(pair.slice(0, eqIdx).trim(), pair.slice(eqIdx + 1));
        }
        return map;
    }

    private mergeCookies(base: string, override: string): string {
        const cookieMap = this.parseCookieString(base);
        for (const [k, v] of this.parseCookieString(override)) {
            cookieMap.set(k, v);
        }
        return Array.from(cookieMap.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
    }
}
