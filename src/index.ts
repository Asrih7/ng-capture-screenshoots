import * as puppeteer from "puppeteer";
import chalk from "chalk";
import  inquirer from "inquirer";
import * as fs from "fs";

// Define a custom type for device names
type DeviceName = keyof typeof puppeteer.devices;

// Function to check if a string is a valid URL
function isValidUrl(string: string): boolean {
    try {
        new URL(string);
        return true;
    } catch (e) {
        return false;
    }
}

// Function to generate a filename from a URL
function createFilenameFromUrl(url: string, deviceType: string, deviceName?: string): string {
    let filename = url
        .replace(/^https?:\/\//, "") // Remove http or https
        .replace(/^www\./, "") // Remove www
        .replace(/\/$/, "") // Remove trailing slash
        .replace(/[\/:.]/g, "_") // Replace other special chars with underscore
        .substring(0, 100); // Limit length to avoid excessively long filenames

    // Append device type or 'pc' to the filename
    if (deviceType === 'mobile' && deviceName) {
        filename += `_${deviceName.toLowerCase()}`;
    } else {
        filename += '_pc';
    }

    // Add file extension
    filename += '.png';

    return filename;
}

// Function to create subfolders if they don't exist
function createSubfoldersIfNotExists(deviceType: string, deviceName?: string): void {
    const folderName = deviceType === 'mobile' ? `${deviceName?.toLowerCase()}-screenshot` : 'pc-screenshot';
    const folderPath = `./screenshots/${folderName}`;

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
}

// Function to take a screenshot of a given URL
// Function to take a screenshot of a given URL
// Function to take a screenshot of a given URL
async function takeScreenshot(page: puppeteer.Page, url: string, deviceType: string, deviceName?: string): Promise<void> {
    console.log(chalk.blue(`Taking screenshot of ${url}...`));

    try {
        createSubfoldersIfNotExists(deviceType, deviceName); // Create subfolders if they don't exist

        const filename = createFilenameFromUrl(url, deviceType, deviceName);
        const filepath = `./screenshots/${deviceType === 'mobile' ? `${deviceName?.toLowerCase()}-screenshot` : 'pc-screenshot'}/${filename}`;

        // Set viewport size based on the device type and name
        if (deviceType === 'mobile' && deviceName && deviceName in puppeteer.devices) {
            const mobileDevice = puppeteer.devices[deviceName as DeviceName];
            await page.emulate(mobileDevice);
        } else {
            await page.setViewport({ width: 1366, height: 768 }); // Default viewport size for PC
        }

        await page.goto(url, { waitUntil: "networkidle0" });

        await page.screenshot({
            path: filepath,
            type: "png",
            fullPage: true,
        });

        console.log(chalk.green(`Screenshot saved as `) + chalk.green.underline(filepath));
    } catch (e) {
        console.error(chalk.red("Error taking screenshot:", e));
    }
}




// Function to prompt the user to choose the device type (PC or Mobile)
async function chooseDeviceType(): Promise<string> {
    const deviceType = await inquirer.prompt([
        {
            type: "list",
            name: "device",
            message: "Choose the device type:",
            choices: ["PC", "Mobile"],
        },
    ]);
    return deviceType.device.toLowerCase();
}

// Function to prompt the user to choose a mobile device
async function chooseMobileDevice(): Promise<DeviceName | undefined> {
    const mobileDevices: DeviceName[] = Object.keys(puppeteer.devices) as DeviceName[];
    const mobileDevice = await inquirer.prompt([
        {
            type: "list",
            name: "device",
            message: "Choose the mobile device:",
            choices: mobileDevices,
        },
    ]);
    return mobileDevice.device;
}

// Function to capture screenshots
async function captureScreenshots(baseURL: string): Promise<void> {
    const deviceType = await chooseDeviceType();
    const deviceName = deviceType === 'mobile' ? await chooseMobileDevice() : undefined; // Handle possible undefined value

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const visitedUrls: Set<string> = new Set();

    // Navigate to the base URL
    await page.goto(baseURL, { waitUntil: "networkidle0" });
    await takeScreenshot(page, baseURL, deviceType, deviceName);
    visitedUrls.add(baseURL);

    let currentUrl = baseURL;

    // Continuously monitor the URLs being visited
    while (true) {
        // Navigate to the current URL
        await page.goto(currentUrl, { waitUntil: "networkidle0" });

        // Capture screenshot of the current URL
        await takeScreenshot(page, currentUrl, deviceType, deviceName);

        // Extract all links from the page
        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll("a"));
            return anchors.map(anchor => anchor.href);
        });

        // Visit each new URL
        let allVisited = true;
        for (const link of links) {
            if (!visitedUrls.has(link)) {
                visitedUrls.add(link);
                currentUrl = link;
                allVisited = false;
                break;
            }
        }

        // Check if all links on the current page have been visited
        if (allVisited) {
            break;
        }
    }

    await browser.close();
}

// Main function to start capturing screenshots
const url = process.argv[2];
if (!url || !isValidUrl(url)) {
    console.error(chalk.red("Invalid URL provided."));
    process.exit(1);
}

captureScreenshots(url);
