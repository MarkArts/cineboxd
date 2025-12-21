import process from "node:process";
const { chromium } = require("playwright");

function showHelp() {
  console.log(`
Usage: node screenshot.js [OPTIONS]

OPTIONS:
  --help           Show this help message
  <port>           Take screenshot of localhost:<port> (default: 3003)
  <url>            Take screenshot of full URL (e.g., https://example.com)

Examples:
  node screenshot.js                    # Screenshots localhost:3003
  node screenshot.js 3000                # Screenshots localhost:3000
  node screenshot.js https://example.com # Screenshots external website

Output:
  - For localhost: desktop-screenshot.png, mobile-screenshot.png
  - For external URLs: desktop-screenshot-external.png, mobile-screenshot-external.png
`);
}

(async () => {
  const arg = process.argv[2];

  // Show help if requested
  if (arg === "--help") {
    showHelp();
    process.exit(0);
  }

  // Determine URL and file prefix
  let url, filePrefix;

  if (!arg) {
    // Default to localhost:3003
    url = "http://localhost:3003";
    filePrefix = "";
  } else if (arg.startsWith("http://") || arg.startsWith("https://")) {
    // Full URL provided
    url = arg;
    filePrefix = "external-";
  } else if (!isNaN(arg)) {
    // Port number provided
    url = `http://localhost:${arg}`;
    filePrefix = "";
  } else {
    console.error(`Error: Invalid argument '${arg}'`);
    showHelp();
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "networkidle" });

    // Wait a bit longer for any dynamic content to load
    await page.waitForTimeout(1000);

    console.log("Taking desktop screenshot...");
    await page.screenshot({
      path: `${filePrefix}desktop-screenshot.png`,
      fullPage: true,
    });

    console.log("Taking mobile screenshot...");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({
      path: `${filePrefix}mobile-screenshot.png`,
      fullPage: true,
    });

    console.log(
      `Screenshots saved: ${filePrefix}desktop-screenshot.png, ${filePrefix}mobile-screenshot.png`,
    );
  } catch (error) {
    console.error("Error taking screenshots:", error.message);
    console.error(
      "\nTip: Make sure the URL is accessible and the server is running.",
    );
    showHelp();
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
