import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    });
    page.on('pageerror', err => {
      console.error('[BROWSER PAGE ERROR]:', err);
    });

    console.log('Navigating to http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 15000 }).catch(e => console.log('goto err:', e.message));

    await new Promise(r => setTimeout(r, 3000));

    const content = await page.content();
    if (content.includes('Application Error')) {
      console.log('FOUND "Application Error" in page HTML!');
      const errorText = await page.evaluate(() => {
        const pre = document.querySelector('pre');
        return pre ? pre.innerText : 'No pre tag found';
      });
      console.log('ERROR IN PRE:', errorText);
    } else {
      console.log('Did not find "Application Error" in page.');
    }

    await browser.close();
  } catch (e) {
    console.error('Diagnostic error:', e);
  }
})();
