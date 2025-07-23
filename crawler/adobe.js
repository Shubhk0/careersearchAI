const puppeteer = require('puppeteer');

const BASE_URL = 'https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced';
const PARALLEL_JOBS = 20;

async function crawlAdobe() {
  console.log('--- Starting Adobe Crawler ---');
  // TODO: Implement Adobe job extraction and pagination logic
  // Use puppeteer to visit BASE_URL, extract jobs, paginate, and extract details
  // Return jobs in the same format as other crawlers
  return [];
}

module.exports = { crawlAdobe }; 