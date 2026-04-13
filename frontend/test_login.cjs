const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
        page.on('requestfailed', request => console.log('REQUEST_FAILED:', request.url(), request.failure().errorText));
        page.on('response', resp => console.log('RESPONSE:', resp.url(), resp.status()));
        
        await page.goto('http://localhost:3000/login');
        await page.waitForSelector('input[type="email"]', {timeout: 5000});
        await page.type('input[type="email"]', 'john@example.com');
        await page.type('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        
        await new Promise(r => setTimeout(r, 4000)); // wait for login to finish and navigate
        await browser.close();
    } catch(e) {
        console.error('SCRIPT_ERROR', e);
        process.exit(1);
    }
})();
