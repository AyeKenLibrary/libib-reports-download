import { chromium } from "@playwright/test";
import AWS from "aws-sdk";
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
const s3 = new AWS.S3({
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  signatureVersion: "v4",
  s3ForcePathStyle: true
});

async function uploadToR2(buffer) {
  await s3
    .putObject({
      Bucket: R2_BUCKET,
      Key: R2_OBJECT_KEY,
      Body: buffer,
      ContentType: "text/csv"
    })
    .promise();

  console.log(`Uploaded CSV to R2: ${R2_BUCKET}/${R2_OBJECT_KEY}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. Go to login page
    await page.goto("https://www.libib.com/login", { waitUntil: "networkidle" });

    // 2. First step: enter email and click "Next"
    await page.fill('input[name="login-email"]', LIBIB_EMAIL);
    await page.click('#login-pre-fetch-submit');

    // Wait for password form to appear
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });

    // 3. Enter password and submit
    await page.fill('input[type="password"]', LIBIB_PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');

    // Wait for navigation to dashboard/home
    await page.waitForLoadState("networkidle");

    console.log("Logged into Libib");

     // 2. Navigate to the reports page
    await page.goto("https://libib.com/reports", { waitUntil: 'networkidle' });
    console.log(await page.title());
    
    // Grab all headings (h1–h6)
//const h1Locator = page.locator('h1').first();

//await h1Locator.waitFor({ state: 'visible' });

//const h1 = await h1Locator.innerText();
//console.log('H1:', h1);


    // 1. Locate the element
//const exportButton = page.locator("text=Export CSV").first();

// 2. Make sure the page is fully hydrated
//await page.waitForLoadState("domcontentloaded");
//await page.waitForLoadState("networkidle");

// 3. Scroll it into view (Cloudflare checks this)
//await exportButton.scrollIntoViewIfNeeded();

// 4. Hover (Cloudflare REALLY checks this)
//await exportButton.hover();

// 5. Add a small human-like delay
//await page.waitForTimeout(350 + Math.random() * 200);

// 6. Focus the element (some CF rules require this)
//await exportButton.focus();

// 7. Click, but don’t wrap it in Promise.all yet
//await exportButton.click({ delay: 120 + Math.random() * 80 });

// 8. NOW wait for the download event
//const download1 = await page.waitForEvent("download", { timeout: 30000 });

  //    const Path = await download1.path();
    //if (!Path) {
      //throw new Error("No download path returned");
    //}
// 9. Save the file
 //const csvBuffer1 = fs.readFileSync(Path);
   // console.log(csvBuffer1);
//await download1.saveAs("current-checkouts.csv");
    
    // 4. Go directly to CSV export URL
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.goto(LIBIB_EXPORT_URL, { waitUntil: "networkidle" })
    ]);

    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error("No download path returned");
    }

    const csvBuffer = fs.readFileSync(downloadPath);
    console.log(`Downloaded CSV (${csvBuffer.length} bytes)`);

    // 5. Upload to R2
    await uploadToR2(csvBuffer);
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error("Libib fetch failed:", err);
  process.exit(1);
});


