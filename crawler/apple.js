const puppeteer = require('puppeteer');

const BASE_URL = 'https://jobs.apple.com/';
const PARALLEL_JOBS = 20;

async function crawlApple() {
  console.log('--- Starting Apple Crawler ---');
  // TODO: Implement Apple job extraction and pagination logic
  // Use puppeteer to visit BASE_URL, extract jobs, paginate, and extract details
  // Return jobs in the same format as other crawlers
  return [];
}

module.exports = { crawlApple }; 