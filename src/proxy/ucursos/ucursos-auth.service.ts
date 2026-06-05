import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const COOKIE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const UCURSOS_HOME = 'https://www.u-cursos.cl/';

@Injectable()
export class UCursosAuthService {
    private cachedCookies: string | null = null;
    private cookiesSetAt: number | null = null;

    constructor(private configService: ConfigService) {}

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

        const browser = await chromium.launch({
            headless: false,
            executablePath: process.env.CHROMIUM_PATH || undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        try {
            const context = await browser.newContext({
                ignoreHTTPSErrors: true,
                userAgent:
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 720 },
            });
            const page = await context.newPage();

            // Load the u-cursos home page so up.js generates a proper OAuth URL with state
            await page.goto(UCURSOS_HOME, { waitUntil: 'load' });
            await page.waitForSelector('#authbox a', { timeout: 10000 });
            const oauthUrl = await page.getAttribute('#authbox a', 'href');
            if (!oauthUrl) throw new Error('[login] Could not find OAuth URL on u-cursos home page');

            await page.goto(oauthUrl, { waitUntil: 'load' });

            // Give reCAPTCHA time to observe the session before interacting
            await page.waitForTimeout(3000);

            await page.click('#usernameInput');
            await page.type('#usernameInput', username.toLowerCase(), { delay: 80 });
            await page.click('#passwordInput');
            await page.type('#passwordInput', password, { delay: 80 });

            // Brief pause before submit, simulates human review
            await page.waitForTimeout(1500);
            await page.click('button[type="submit"]');
            await page.waitForURL('https://www.u-cursos.cl/**', {
                timeout: 30000,
                waitUntil: 'load',
            });

            const cookies = await context.cookies('https://www.u-cursos.cl');
            if (!cookies.length) throw new Error('[login] No cookies after OAuth redirect');
            return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        } finally {
            await browser.close();
        }
    }
}
