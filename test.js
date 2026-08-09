const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => {
        if (!msg.text().includes('Texture marked for update')) {
            console.log('PAGE LOG:', msg.text());
        }
    });
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
    
    const uri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
    await page.goto(uri, { waitUntil: 'networkidle0' });
    
    console.log("Clicking start button...");
    await page.click('#start-btn');
    await new Promise(r => setTimeout(r, 1000));

    console.log("Buying drone...");
    await page.keyboard.press('KeyB');
    await new Promise(r => setTimeout(r, 500));
    await page.click('#btn-drone');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));

    console.log("Deploying drone...");
    await page.keyboard.press('Digit4');
    await new Promise(r => setTimeout(r, 500));
    
    await page.evaluate(() => {
        if (window.handleShooting) {
            window.handleShooting(true);
        }
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Opening buy menu in drone...");
    await page.keyboard.press('KeyB');
    await new Promise(r => setTimeout(r, 500));
    
    console.log("Buying 50 hegrenades via evaluate...");
    await page.evaluate(() => {
        for(let i=0; i<50; i++) {
            window.buyWeapon('hegrenade', 150);
        }
    });
    
    const fps = await page.evaluate(() => window.frameCount);
    console.log("Frames passed:", fps);
    await new Promise(r => setTimeout(r, 1000));
    const fps2 = await page.evaluate(() => window.frameCount);
    console.log("Frames passed in 1 sec:", fps2 - fps);

    await browser.close();
})();
