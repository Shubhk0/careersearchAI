const puppeteer = require('puppeteer');

const BASE_URL = 'https://jobs.netflix.com/';
const PARALLEL_JOBS = 20;

async function crawlNetflix() {
  console.log('--- Starting Netflix Crawler ---');
  // TODO: Implement Netflix job extraction and pagination logic
  // Use puppeteer to visit BASE_URL, extract jobs, paginate, and extract details
  // Return jobs in the same format as other crawlers
  return [];
}

module.exports = { crawlNetflix }; 