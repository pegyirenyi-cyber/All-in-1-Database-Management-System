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

    console.log('--- TEST 1: Default launch ---');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));
    let content = await page.content();
    console.log('Has Application Error?', content.includes('Application Error'));

    console.log('--- TEST 2: Logged in as Admin pegyirenyi@gmail.com ---');
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
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    content = await page.content();
    console.log('Admin Has Application Error?', content.includes('Application Error'));
    if (content.includes('Application Error')) {
      const err = await page.evaluate(() => document.querySelector('pre')?.innerText);
      console.log('Admin Error message:', err);
    }

    console.log('--- TEST 3: Logged in as Teacher ---');
    await page.evaluate(() => {
      const teacherUser = {
        uid: 'teacher_test_1',
        email: 'teacher@school.com',
        role: 'Teacher',
        name: 'Class Teacher',
        schoolId: 'school_default',
        schoolCode: 'GES001',
        staffId: 'STF001',
        assignedClasses: ['Basic 1'],
        assignedSubjects: ['English', 'Mathematics'],
        setupWizardCompleted: true,
        plan: 'free',
        isActivated: true
      };
      localStorage.setItem('sms_current_user', JSON.stringify(teacherUser));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    content = await page.content();
    console.log('Teacher Has Application Error?', content.includes('Application Error'));
    if (content.includes('Application Error')) {
      const err = await page.evaluate(() => document.querySelector('pre')?.innerText);
      console.log('Teacher Error message:', err);
    }

    console.log('--- TEST 4: Visiting all tabs as Admin ---');
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
    });

    const tabs = ['dashboard', 'students', 'teachers', 'attendance', 'assessments', 'finances', 'admin_dashboard', 'school_profile', 'paystack', 'communications', 'emis', 'settings'];
    for (const tab of tabs) {
      await page.goto(`http://localhost:3000?tab=${tab}`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1500));
      content = await page.content();
      if (content.includes('Application Error')) {
        const err = await page.evaluate(() => document.querySelector('pre')?.innerText);
        console.log(`Tab ${tab} Has Application Error! Error:`, err);
      } else {
        console.log(`Tab ${tab} OK`);
      }
    }

    console.log('All Captured Errors:', errors);
    await browser.close();
  } catch (e) {
    console.error('Test execution error:', e);
  }
})();
