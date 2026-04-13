const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
        page.on('response', resp => {
            if (resp.url().includes('localhost:8080')) {
                console.log('RESPONSE:', resp.request().method(), resp.url(), resp.status());
            }
        });
        
        console.log('--- Registering ---');
        await page.goto('http://localhost:3000/register');
        await page.waitForSelector('#reg-name', {timeout: 5000});
        
        const ts = Date.now();
        await page.type('#reg-name', 'Test User');
        await page.type('#reg-email', `test_${ts}@example.com`);
        await page.type('#reg-password', 'password123');
        await page.type('#reg-phone', `999${ts.toString().slice(-7)}`);
        
        await page.click('button[type="submit"]');
        await new Promise(r => setTimeout(r, 6000));
        
        console.log('--- Dashboard ---');
        await page.goto('http://localhost:3000/dashboard');
        await new Promise(r => setTimeout(r, 3000));
        
        await browser.close();
    } catch(e) {
        console.error('SCRIPT_ERROR', e);
        process.exit(1);
    }
})();
