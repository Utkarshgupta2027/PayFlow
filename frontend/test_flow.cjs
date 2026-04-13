const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
        page.on('response', resp => console.log('RESPONSE:', resp.request().method(), resp.url(), resp.status()));
        
        // 1. Register
        console.log('--- REGISTERING ---');
        await page.goto('http://localhost:3000/register');
        await page.waitForSelector('input[name="name"]', {timeout: 5000});
        
        const timestamp = Date.now();
        const email = `testuser_${timestamp}@example.com`;
        
        await page.type('input[name="name"]', 'Test User');
        await page.type('input[name="email"]', email);
        await page.type('input[name="password"]', 'password123');
        await page.type('input[name="phoneNumber"]', `9876${timestamp.toString().slice(-6)}`);
        
        await page.click('button[type="submit"]');
        await page.waitForNavigation();
        
        // 2. Wait to land on dashboard
        await new Promise(r => setTimeout(r, 2000));
        
        // 3. Try hitting Split Payment page
        console.log('--- OPENING SPLIT PAYMENT ---');
        await page.goto('http://localhost:3000/split-payment');
        await new Promise(r => setTimeout(r, 2000));
        
        // 4. Try Add Money
        console.log('--- ADD MONEY ---');
        await page.goto('http://localhost:3000/dashboard');
        await page.waitForSelector('button', {timeout: 5000});
        
        // Wait and close
        await new Promise(r => setTimeout(r, 2000)); 
        await browser.close();
    } catch(e) {
        console.error('SCRIPT_ERROR', e);
        process.exit(1);
    }
})();
