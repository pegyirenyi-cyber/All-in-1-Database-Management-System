import puppeteer from 'puppeteer';

(async () => {
  try {
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

    console.log('--- TEST: Admin visiting finances -> fees subtab ---');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const adminUser = {
        uid: 'admin_test_1',
        email: 'pegyirenyi@gmail.com',
        role: 'Admin',
        name: 'Peggy Irenyi',
        schoolId: 'school_default',
        schoolCode: 'GES001',
        setupWizardCompleted: true,
        plan: 'premium',
        isActivated: true
      };
      localStorage.setItem('sms_current_user', JSON.stringify(adminUser));
      localStorage.setItem('sms_setup_wizard_completed', 'true');
    });

    await page.goto('http://localhost:3000?tab=finances', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    // Now find and click the "fees" subtab button inside finances
    const subtabs = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(b => b.innerText.trim()).filter(Boolean);
    });
    console.log('Buttons on page:', subtabs.slice(0, 20));

    // Click School Fees button
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const feeBtn = btns.find(b => b.innerText.includes('School Fees') || b.innerText.includes('Fees'));
      if (feeBtn) {
        feeBtn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked fees button?', clicked);
    await new Promise(r => setTimeout(r, 3000));

    let content = await page.content();
    console.log('Has Application Error after clicking School Fees?', content.includes('Application Error'));
    if (content.includes('Application Error')) {
      const err = await page.evaluate(() => document.querySelector('pre')?.innerText);
      console.log('Fees Error message:', err);
    }

    console.log('Errors captured:', errors);
    await browser.close();
  } catch (e) {
    console.error('Test error:', e);
  }
})();
