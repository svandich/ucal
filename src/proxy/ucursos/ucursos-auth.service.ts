import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Page } from 'patchright';

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
                viewport: { width: 1280, height: 720 },
            });
            const page = await context.newPage();

            // Load the u-cursos home page and submit the login form to reach the OAuth page with a proper state
            await page.goto(UCURSOS_HOME, { waitUntil: 'load' });
            await page.waitForSelector('#boton_login', { timeout: 10000 });
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }),
                page.click('#boton_login'),
            ]);

            // Give Turnstile time to observe the session before interacting
            await page.waitForTimeout(3000);

            await this.solveTurnstile(page);

            await page.click('#usernameInput');
            await page.type('#usernameInput', username.toLowerCase(), { delay: 80 });
            await page.click('#passwordInput');
            await page.type('#passwordInput', password, { delay: 80 });

            // Brief pause before submit, simulates human review
            await page.waitForTimeout(1500);
            await page.click('#loginSubmitBtn');
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

    private async solveTurnstile(page: Page): Promise<void> {
        const widget = page.locator('#turnstileWidget');
        if (!(await widget.count())) return;

        const box = await widget.boundingBox();
        if (!box) throw new Error('[login] Turnstile widget has no bounding box');

        const clickX = box.x + 22;
        const clickY = box.y + box.height / 2;
        await page.mouse.move(clickX - 60, clickY - 30, { steps: 10 });
        await page.waitForTimeout(200);
        await page.mouse.move(clickX, clickY, { steps: 10 });
        await page.waitForTimeout(200);
        await page.mouse.click(clickX, clickY);

        await page
            .waitForFunction(
                () =>
                    (document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null)
                        ?.value,
                { timeout: 15000 },
            )
            .catch(() => {
                throw new Error('[login] Turnstile verification did not complete');
            });
    }
}
