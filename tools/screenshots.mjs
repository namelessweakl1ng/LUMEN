// Capture production application screens with live source data; no response interception.
import { chromium } from '../frontend/node_modules/playwright/index.mjs';
const base = process.env.LUMEN_SCREENSHOT_URL || 'http://127.0.0.1:3100';
const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args:['--no-sandbox'] } : {})});
const evidence = [];
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const visit = async path => { await page.goto(base+path); await page.locator('main').waitFor(); };
  const capture = async name => {
    const issues = await page.evaluate(() => {
      const visible = element => element.getClientRects().length > 0;
      const controls = [...document.querySelectorAll('button,input:not([type=checkbox]),select,textarea,.lumen-panel,.result-item')].filter(visible);
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        rounded: controls.filter(e => parseFloat(getComputedStyle(e).borderTopLeftRadius) !== 0).map(e => e.tagName),
        gradients: [...document.querySelectorAll('body,main,button,.lumen-panel')].filter(visible).filter(e => getComputedStyle(e).backgroundImage.includes('gradient')).map(e => e.tagName),
      };
    });
    evidence.push({screen:name,...issues});
    if (issues.overflow || issues.rounded.length || issues.gradients.length) throw new Error(`Visual constraint failed: ${JSON.stringify(evidence.at(-1))}`);
    await page.screenshot({path:`docs/screenshots/v3-${name}.png`,fullPage:true});
  };
  await visit('/settings');
  await page.getByRole('button',{name:'Light',exact:true}).click();
  await visit('/');
  await page.getByLabel('Search profile').waitFor();
  await capture('home-light');
  await visit('/settings');
  await page.getByRole('button',{name:'Dark',exact:true}).click();
  await visit('/');
  await capture('home-dark');
  await visit('/settings');
  await page.getByRole('button',{name:'Light',exact:true}).click();
  await visit('/search?q=python&limit=10');
  await page.getByTestId('search-result').first().waitFor({timeout:30000});
  await capture('results-desktop');
  await page.getByRole('button',{name:/^Filters/}).click();
  await capture('filters');
  await page.getByRole('button',{name:/^Filters/}).click();
  const first = page.getByTestId('search-result').first();
  await first.getByRole('button',{name:/Save .* to research workspace/}).click();
  await first.getByRole('group').getByRole('button',{name:'Inbox',exact:true}).click();
  await visit('/workspace');
  await page.getByRole('region',{name:'Selected saved item'}).waitFor();
  await page.getByLabel('New collection name').fill('Python research');
  await page.getByRole('button',{name:'Create collection',exact:true}).click();
  await page.getByRole('region',{name:'Selected saved item'}).getByRole('textbox',{name:/Notes for /}).fill('Compare official documentation with research findings.');
  await page.getByRole('region',{name:'Selected saved item'}).getByRole('textbox',{name:/Tags for /}).fill('python, reference');
  await page.getByLabel('New collection name').focus();
  await capture('workspace');
  await visit('/profiles');
  await page.getByRole('heading',{name:'Search profiles',exact:true}).waitFor();
  await capture('profiles');
  await visit('/settings');
  await capture('settings');
  await visit('/compare?q=python');
  await page.getByRole('button',{name:'Compare profiles',exact:true}).click();
  await page.getByRole('region',{name:'left comparison results'}).waitFor({timeout:30000});
  await capture('comparison');
  await page.setViewportSize({width:390,height:844});
  await visit('/search?q=python&limit=10');
  await page.getByTestId('search-result').first().waitFor({timeout:30000});
  await capture('results-mobile');
  const fs = await import('node:fs/promises');
  await fs.writeFile('docs/screenshots/v3-visual-checks.json',JSON.stringify({mode:'production Docker application, live public API results, no interception',screens:evidence},null,2)+'\n');
  console.log(`Captured ${evidence.length} production screens; zero overflow, rounded controls, or gradients.`);
} finally {await browser.close();}
