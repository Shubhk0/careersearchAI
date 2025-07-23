const puppeteer = require('puppeteer');

const BASE_URL = 'https://www.ibm.com/employment/';
const PARALLEL_JOBS = 20;

async function crawlIBM() {
  console.log('--- Starting IBM Crawler ---');
  // TODO: Implement IBM job extraction and pagination logic
  // Use puppeteer to visit BASE_URL, extract jobs, paginate, and extract details
  // Return jobs in the same format as other crawlers
  return [];
}

module.exports = { crawlIBM }; 