const puppeteer = require('puppeteer');
const path = require('path');

const screenshotsDir = path.join(__dirname, 'screenshots');

const pages = [
  { name: 'home', url: 'http://localhost:5173/', label: '首页' },
  { name: 'note-runner', url: 'http://localhost:5173/note-runner', label: '音符跑酷' },
  { name: 'chord-puzzle', url: 'http://localhost:5173/chord-puzzle', label: '和弦解谜' },
  { name: 'mode-composer', url: 'http://localhost:5173/mode-composer', label: '调式作曲' },
  { name: 'ear-training', url: 'http://localhost:5173/ear-training', label: '听音训练' },
  { name: 'encyclopedia', url: 'http://localhost:5173/encyclopedia', label: '音乐百科' },
];

async function takeScreenshots() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const fs = require('fs');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  for (const page of pages) {
    const tab = await browser.newPage();
    await tab.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await tab.goto(page.url, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));
    const filePath = path.join(screenshotsDir, `${page.name}.png`);
    await tab.screenshot({ path: filePath, fullPage: false });
    console.log(`Screenshot saved: ${filePath} (${page.label})`);
    await tab.close();
  }

  await browser.close();
  console.log('All screenshots taken!');
}

takeScreenshots().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
