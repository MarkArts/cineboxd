const { chromium } = require('playwright');

const port = process.argv[2] || '3003';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log(`Navigating to localhost:${port}...`);
    await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
    
    // Wait a bit longer for any dynamic content to load
    await page.waitForTimeout(300);
    
    console.log('Taking desktop screenshot...');
    await page.screenshot({ 
      path: 'desktop-screenshot.png', 
      fullPage: true 
    });
    
    console.log('Taking mobile screenshot...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ 
      path: 'mobile-screenshot.png', 
      fullPage: true 
    });
    
    console.log('Screenshots saved!');
  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
})();
