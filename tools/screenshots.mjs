// Capture the working application with live source data; no response interception.
import {chromium} from '../frontend/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}: {})});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(process.env.LUMEN_SCREENSHOT_URL||'http://127.0.0.1:3001');
 await page.getByRole('button',{name:'General',exact:true}).waitFor();
 await page.screenshot({path:'docs/screenshots/home.png',fullPage:true});
 await page.getByLabel('Search sources',{exact:true}).fill('python');
 await page.getByLabel('Search sources',{exact:true}).press('Enter');
 await page.getByTestId('search-result').first().waitFor({timeout:20000});
 await page.getByRole('button',{name:'Compare',exact:true}).click();
 await page.getByTestId('comparison-results').waitFor({timeout:20000});
 await page.screenshot({path:'docs/screenshots/search.png',fullPage:true});
 await page.getByTestId('search-result').first().getByRole('button',{name:/Save .* to research workspace/}).click();
 await page.getByRole('button',{name:'Workspace',exact:true}).click();
 await page.getByRole('heading',{name:'Research workspace'}).waitFor();
 await page.screenshot({path:'docs/screenshots/workspace.png',fullPage:true});
 console.log('Captured three screenshots of the working UI with live provider results.');
} finally {await browser.close();}
