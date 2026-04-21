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
  const browser = await chromium.launch({headless: true, args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu",],});
  const context = await browser.newContext({ acceptDownloads:true });
  const page = await context.newPage();
  await page.waitForTimeout(30000 * Math.random());
  
  try {
    
    // 1. Real browser headers (helps with Cloudflare + hydration)
  await context.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "en-GB,en;q=0.9"
  });

  // 2. Go to login page on *www* (matches your cookie domain)
  await page.goto("https://www.libib.com/login", {
    waitUntil: "domcontentloaded"
  });

  // 3. Wait for either:
  //    - hydrated login form, or
  //    - pre-fetch form (fallback path)
  const hydratedForm = page.locator('form#login-form input[name="login-email"]');
  const prefetchForm = page.locator('form#login-pre-fetch input[name="login-email"]');

  if (await hydratedForm.count()) {
    // --- Path A: hydrated form is already there ---
    await page.fill('form#login-form input[name="login-email"]', LIBIB_EMAIL);
    await page.fill('form#login-form input[name="login-password"]', LIBIB_PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      page.click('form#login-form button[type="submit"]')
    ]);
  } else if (await prefetchForm.count()) {
    // --- Path B: only pre-fetch form visible, trigger hydration ---
    await page.fill('form#login-pre-fetch input[name="login-email"]', LIBIB_EMAIL);

    await Promise.all([
      // This click should cause JS to load the real login form
      page.click("#login-pre-fetch-submit"),
      page.waitForTimeout(1500) // give hydration a moment
    ]);

    // Now wait for hydrated form
    await page.waitForSelector('form#login-form input[name="login-password"]', {
      timeout: 15000
    });

    await page.fill('form#login-form input[name="login-email"]', LIBIB_EMAIL);
    await page.fill('form#login-form input[name="login-password"]', LIBIB_PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      page.click('form#login-form button[type="submit"]')
    ]);
  } else {
    throw new Error("Neither hydrated login form nor pre-fetch form found on /login");
  }

  // 4. Sanity check: we should NOT still be on /login
  const url = page.url();
  if (url.includes("/login")) {
    throw new Error(`Still on /login after submit, URL: ${url}`);
  }

  // 5. Check cookies — we want more than just PHPSESSID
  const cookies = await context.cookies();
  console.log("Libib cookies after login:", cookies);

  const hasOnlyPhpSessId =
    cookies.length === 1 && cookies[0].name === "PHPSESSID";

  if (hasOnlyPhpSessId) {
    throw new Error("Login did not complete: only PHPSESSID present");
  }

  console.log("Libib login: session looks valid");
    
    throw e;
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    //Go to login page
    for (let i = 1; i <= 3; i++){
      try {
            console.log("Libib Login Page Navigate Attempt: ", i);
            await page.goto("https://libib.com/login", { waitUntil: "domcontentloaded" });
            await page.waitForSelector('input[name="login-email"]');

            const loginForm = await page.locator('form[action*="login"]').count();
            if (loginForm > 0) {
              console.log('On login page: ', await page.title());
            } else {
              console.log('Login Form Missing: ', loginForm);
              throw e;
            }
            const hasEmailField = await page.locator('input[name="login-email"]').count();
            if (hasEmailField > 0) {
              console.log('Input Email Field Present');
              break
            } else {
              console.log('Missing Input Email Field');
              throw e;
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
            console.log(await page.title());
            await page.waitForSelector('.report-csv');
            const DownloadCurrentCheckoutsButton = await page.getByRole('button', { name: 'Current Checkouts' }).count(); 
            if (DownloadCurrentCheckoutsButton > 0){
                console.log("Download Current Checkouts Button Present: ", DownloadCurrentCheckoutsButton);
                break
              } else {
                  console.log("Button for Downloading Current Checkouts Missing", DownloadCurrentCheckoutsButton);
                  throw e;
              } 
            break
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
            var [download] = await Promise.all([
              page.waitForEvent('download'), { timeout: 60_000 },
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
            
            //Verify logged out of Libib
            await page.waitForSelector('input[name="login-email"]');
            const loginFormAgain = await page.locator('form[action*="login"]').count();
            if (loginFormAgain > 0) {
              console.log('On Login Page Again: Successfully Logged out of Libib');
              break
            } else {
                    console.log('Problem Logging Out: Email Login Form Missing: ', loginFormAgain);
                    throw e;
            }
          
      } catch (e) {
                    console.error("Logout Attempt Error Message: ", e);
                    if (i === 3) throw e;
                    await page.waitForTimeout(5000 * i + Math.random() * 2000);
                  }
    }
    
    
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch(err => {
  console.error("Libib fetch failed:", err);
  process.exit(1);
});


