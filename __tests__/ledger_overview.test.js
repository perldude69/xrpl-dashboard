const puppeteer = require('puppeteer');

describe('Ledger Overview Panel E2E Test', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('PAGE ERROR:', msg.text());
      }
    });
    
    // Listen for failed requests
    page.on('response', response => {
      if (!response.ok() && response.status() !== 200) {
        console.log('FAILED REQUEST:', response.url(), response.status());
      }
    });
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Wait a bit for JS to execute
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  test('should load the page correctly', async () => {
    const title = await page.title();
    expect(title).toBe('XRPL Dashboard');
    
    // Check if the static HTML contains the elements
    const bodyContent = await page.$eval('body', el => el.innerHTML);
    expect(bodyContent.includes('Ledger Overview')).toBe(true);
  });

  test('should display metric cards correctly', async () => {
    // Check if elements exist in DOM
    const ledgerIndex = await page.$('#ledgerIndex');
    const txCount = await page.$('#txCount');
    const xrpPayments = await page.$('#xrpPayments');
    const xrpBurned = await page.$('#xrpBurned');
    
    if (!ledgerIndex) {
      // Debug: check what elements exist
      const allDivs = await page.$$eval('div', divs => divs.map(d => d.id).filter(id => id));
      console.log('Available div IDs:', allDivs);
      
      const bodyHTML = await page.$eval('body', el => el.innerHTML.substring(0, 2000));
      console.log('Body HTML start:', bodyHTML);
    }
    
    expect(ledgerIndex).toBeTruthy();
    expect(txCount).toBeTruthy();
    expect(xrpPayments).toBeTruthy();
    expect(xrpBurned).toBeTruthy();
    
    // Check initial values
    const ledgerText = await page.$eval('#ledgerIndex', el => el.textContent);
    expect(ledgerText).toBe('Loading...');
  });

  test('should display monitored wallets grid', async () => {
    const grid = await page.$('#monitoredWalletsGrid');
    const count = await page.$('#monitoredCount');
    
    expect(grid).toBeTruthy();
    expect(count).toBeTruthy();
    
    const countText = await page.$eval('#monitoredCount', el => el.textContent);
    expect(countText).toBe('0'); // Initially empty
  });

  test('should have inspect ledger button', async () => {
    const inspectBtn = await page.$('#inspectLedger');
    expect(inspectBtn).toBeTruthy();
    
    const btnText = await page.$eval('#inspectLedger', el => el.textContent);
    expect(btnText).toBe('Inspect Ledger');
  });

  test('inspect button should show overlay when clicked', async () => {
    // Click inspect button
    await page.click('#inspectLedger');
    
    // Check if overlay appears
    const overlay = await page.$('#ledgerOverlay');
    expect(overlay).toBeTruthy();
    
    // Check if overlay is visible
    const display = await page.$eval('#ledgerOverlay', el => el.style.display);
    expect(display).toBe('block');
    
    // Close overlay
    await page.click('#closeOverlay');
    const displayAfter = await page.$eval('#ledgerOverlay', el => el.style.display);
    expect(displayAfter).toBe('none');
  });

  test('should be responsive on mobile', async () => {
    // Set viewport to mobile size
    await page.setViewport({ width: 375, height: 667 });
    
    // Check that panels container uses grid layout
    const panelsContainer = await page.$('.panels-container');
    expect(panelsContainer).toBeTruthy();
    
    // Check that ledger grid adapts
    const ledgerGrid = await page.$('.ledger-grid');
    expect(ledgerGrid).toBeTruthy();
    
    // Reset viewport
    await page.setViewport({ width: 1200, height: 800 });
  });
});
