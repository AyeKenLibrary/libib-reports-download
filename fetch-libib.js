import { chromium } from "@playwright/test";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  LIBIB_EMAIL,
  LIBIB_PASSWORD,
  LIBIB_EXPORT_URL,   // direct CSV export URL from Libib
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_OBJECT_KEY = "libib-lending.csv"
} = process.env;

if (!LIBIB_EMAIL || !LIBIB_PASSWORD || !LIBIB_EXPORT_URL) {
  console.error("Missing LIBIB_EMAIL / LIBIB_PASSWORD / LIBIB_EXPORT_URL");
  process.exit(1);
}

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("Missing R2_* env vars");
  process.exit(1);
}

// Configure R2 (S3-compatible)
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

async function uploadToR2(buffer) {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: R2_OBJECT_KEY,
      Body: buffer,
      ContentType: "text/csv"
    })
  );
  console.log(`Uploaded CSV to R2: ${R2_BUCKET}/${R2_OBJECT_KEY}`);
}

async function run() {

  //let browser;
  let context;
  let page;
  let download;
  
  try {
        
        //Check profile directory exists and create if missing
        if (!fs.existsSync(".github/pw-profile/")) {
          fs.mkdirSync(".github/pw-profile/", { recursive: true });
        }
    
        //Delete any leftover lockfiles
        const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
        for (const file of lockFiles) {
          const fp = path.join(".github/pw-profile/", file);
          if (fs.existsSync(fp)) {
            try { fs.unlinkSync(fp); } catch (_) {}
          }
        }
        //Launch context
        context = await chromium.launchPersistentContext(".github/pw-profile/", { 
                                              headless: true, 
                                              args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu", "--disable-blink-features=AutomationControlled", "--window-size=1280,800", "--start-maximized", "--ignore-certificate-errors", "--ignore-certificate-errors-spki-list", "--disable-features=IsolateOrigins,site-per-process", "--disable-features=OptimizationGuideModelDownloading", "--disable-features=MediaRouter", "--disable-component-update", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",  "--disable-sync",  "--disable-domain-reliability", "--disable-breakpad",],
                                              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                                              locale: 'en-US',
                                              timezoneId: 'America/New_York',
                                              viewport: { width: 1280, height: 800 },
                                              deviceScaleFactor: 1,
                                              permissions: ['geolocation', 'notifications'],
                                              geolocation: { latitude: 40.7128, longitude: -74.0060 },
                                              colorScheme: 'light',
                                              extraHTTPHeaders: {'Accept-Language': 'en-US,en;q=0.9','Sec-CH-UA': '"Chromium";v="123", "Not:A-Brand";v="8", "Google Chrome";v="123"', 'Sec-CH-UA-Mobile': '?0', 'Sec-CH-UA-Platform': '"Windows"',},
                                              reducedMotion: 'no-preference',
                                              acceptDownloads: true }
                                            );
          //Open page
          page = context.pages()[0] || await context.newPage();
          //Hydration delay
          await page.waitForTimeout(250);
          //Random jitter
          await page.waitForTimeout(5000 * Math.random());
  } catch (e) {
                  console.error('Failed to open persistent context:', e);
                  throw e; // propagate to CI / caller

              }
  try {
    
    //Go to login page
    for (let i = 1; i <= 3; i++){
      try {
            console.log("Libib Login Page Navigate Attempt: ", i);
            await page.goto("https://libib.com", { waitUntil: "domcontentloaded" });
            console.log('Page Title Resulting From Navigation to Libib.com: ', await page.title());
            //Hydration delay
            await page.waitForTimeout(250);
            //Random jitter
            await page.waitForTimeout(5000 * Math.random());
            await page.goto("https://libib.com/login", { waitUntil: "domcontentloaded" });
            console.log('Page Title Resulting From Navigation Attempt to Login Page: ', await page.title());
            await page.waitForSelector('input[name="login-email"]');
    
            const loginForm = await page.locator('form[action*="login"]').count();
            if (loginForm > 0) {
              console.log('Login Form Visible');
            } else {
              throw new Error("Login Form Missing: ", loginForm);
            }
            const hasEmailField = await page.locator('input[name="login-email"]').count();
            if (hasEmailField > 0) {
              console.log('Input Email Field Present');
              break
            } else {
              throw new Error("Missing Input Email Field");
            }
          } catch (e) {
                    console.error("Navigate to Login Page Error: ", e);
                    if (i === 3) throw e;
                    await page.waitForTimeout(5000 * i + Math.random() * 2000);
                  }
    }
    
           
    //Enter email and click "Next"
    await page.fill('input[name="login-email"]', LIBIB_EMAIL);
    await page.click('#login-pre-fetch-submit');

    //Wait for password form to appear
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
   
    //Enter password and submit
    await page.fill('input[type="password"]', LIBIB_PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');
    
    // Wait for navigation to dashboard/home
    await page.waitForLoadState("domcontentloaded");
    
    
    console.log("Logged into Libib");

   
    // Navigate to the reports page
    for (let i = 1; i <= 3; i++){
      try {
            console.log("Reports Page Navigate Attempt: ", i);
            await page.goto("https://libib.com/reports", { waitUntil: 'domcontentloaded' });
            console.log("Page Title Resulting From Navigation Attempt to Reports Page:", await page.title());
            await page.waitForSelector('.report-csv');
            const DownloadCurrentCheckoutsButton = await page.getByRole('button', { name: 'Current Checkouts' }).count(); 
            if (DownloadCurrentCheckoutsButton > 0){
                console.log("Download Current Checkouts Button Present: ", DownloadCurrentCheckoutsButton);
                break
              } else {
                  throw new Error("Button for Downloading Current Checkouts Missing");
              } 
      } catch (e) {
                    console.error("Navigate to Reports Page Error Message: ", e);
                    if (i === 3) throw e;
                    await page.waitForTimeout(5000 * i + Math.random() * 2000);
                  }
    }
    
    //Download report 
    for (let i = 1; i <= 3; i++){
      try {   
            console.log("Download Attempt: ", i);
            [download] = await Promise.all([
              page.waitForEvent('download'), 
              page.getByRole('button', { name: 'Current Checkouts' }).click()
            ]);
            break
      } catch (e) {
                    console.error("Download Attempt Error Message: ", e);
                    if (i === 3) throw e;
                    await page.waitForTimeout(5000 * i + Math.random() * 2000);
                  }
    }

      //Check that download path exists
    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error("No download path returned");
    }
      //Download report if download path exists 
    const csvBuffer = fs.readFileSync(downloadPath);
    console.log(`Downloaded CSV (${csvBuffer.length} bytes)`);

    //Upload downloaded report to R2
    await uploadToR2(csvBuffer);

    //Logout of Libib
    for (let i = 1; i <= 3; i++){
      try { 
            console.log("Libib Logout Page Navigate Attempt: ", i);
            await page.goto('https://libib.com/logout', { waitUntil: 'networkidle' });
            console.log('Page Title Resulting From Navigation to Logout Page: ', await page.title());
            //Verify logged out of Libib
            await page.waitForSelector('input[name="login-email"]');
            const loginFormAgain = await page.locator('form[action*="login"]').count();
            if (loginFormAgain > 0) {
              console.log('On Login Page Again: Successfully Logged out of Libib');
              break
            } else {
                    throw new Error('Problem Logging Out: Email Login Form Missing: ', loginFormAgain);
            }
          
      } catch (e) {
                    console.error("Logout Attempt Error Message: ", e);
                    if (i === 3) throw e;
                    await page.waitForTimeout(5000 * i + Math.random() * 2000);
                  }
    }
    
    
  } finally {
      if (page && !page.isClosed()) {
        try {
              await page.goto('https://libib.com/logout', { waitUntil: 'networkidle' });
              console.log("Successful Libib log out in finally");
            } catch (e) {
                          console.log('Logout failed (likely harmless): ', e.message);
                        }
      }
      if (context) {
        try {
              await context.close(); // closes Chromium + flushes profile
              console.log("Context Successfully Closed");
            } catch (e) {
                          console.error('Error Whilst Closing Context:', e);
                        }
      }
    
     // if (browser) {
       // await browser.close();
        //console.log("Browser Successfully Closed");
      //}
  }
}

run().catch(err => {
  console.error("Libib fetch failed:", err);
  process.exit(1);
});


