import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), 'error:', request.failure()?.errorText);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('HTTP ERROR RESPONSE:', response.url(), 'status:', response.status());
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await browser.close();
})();
