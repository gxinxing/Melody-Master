const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const screenshotsDir = path.join(__dirname, 'screenshots');

async function takeDesktopScreenshots() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const tab = await browser.newPage();
  await tab.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  await tab.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  const filePath = path.join(screenshotsDir, 'home-desktop.png');
  await tab.screenshot({ path: filePath, fullPage: false });
  console.log(`Desktop screenshot saved: ${filePath}`);

  await tab.goto('http://localhost:5173/note-runner', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  const filePath2 = path.join(screenshotsDir, 'note-runner-desktop.png');
  await tab.screenshot({ path: filePath2, fullPage: false });
  console.log(`Desktop screenshot saved: ${filePath2}`);

  await tab.goto('http://localhost:5173/chord-puzzle', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  const filePath3 = path.join(screenshotsDir, 'chord-puzzle-desktop.png');
  await tab.screenshot({ path: filePath3, fullPage: false });
  console.log(`Desktop screenshot saved: ${filePath3}`);

  await browser.close();
  console.log('Desktop screenshots done!');
}

takeDesktopScreenshots().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
