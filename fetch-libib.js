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
    await page.goto("https://libib.com/reports");

    // 3. Trigger the CSV download by clicking the button
    const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByText("Current Checkouts").click()   // or the exact selector
    ]);
    // 4. Save the file
    const path = await download.path();
    const csvBuffer1 = fs.readFileSync(path);
    console.log('csvBuffer1);
    await download.saveAs("loans.csv");
    
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


