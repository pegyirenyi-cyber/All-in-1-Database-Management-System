import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`[CONSOLE ERROR]: ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    errors.push(`[PAGE ERROR]: ${err.toString()}`);
  });

  console.log('--- TEST 1: Cold start (clean storage) ---');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  let content = await page.content();
  console.log('Cold start Application Error:', content.includes('Application Error'));
  if (content.includes('Application Error')) {
    const err = await page.evaluate(() => document.querySelector('pre')?.innerText);
    console.log('Error:', err);
  }

  console.log('--- TEST 2: Users list with null/missing emails in localStorage ---');
  await page.evaluate(() => {
    localStorage.setItem('sms_users_list', JSON.stringify([
      { uid: 'u1', name: 'User 1' }, // NO email
      { uid: 'u2', name: 'User 2', email: null }, // NULL email
      { uid: 'u3', name: 'User 3', email: '' } // EMPTY email
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  content = await page.content();
  console.log('Null email test Application Error:', content.includes('Application Error'));
  if (content.includes('Application Error')) {
    const err = await page.evaluate(() => document.querySelector('pre')?.innerText);
    console.log('Error:', err);
  }

  console.log('Captured errors:', errors);
  await browser.close();
})();
