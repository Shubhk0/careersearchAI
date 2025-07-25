const puppeteer = require('puppeteer');

const BASE_URL = 'https://www.amazon.jobs/en/search';
const PARALLEL_JOBS = 40; // Increased parallelism
const MAX_PAGES = 40;

async function setBlockResources(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if ([ 'image', 'stylesheet', 'font' ].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

async function crawlAmazon() {
  console.log('--- Starting Amazon Crawler ---');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await setBlockResources(page);
  let jobs = [];
  let jobLinks = new Set();
  let pageNum = 1;
  let hasNext = true;

  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  while (hasNext && pageNum <= MAX_PAGES) {
    console.log(`Reading page ${pageNum}...`);
    try {
      await page.waitForSelector('.job-tile', { timeout: 15000 });
    } catch {
      console.warn(`  No job cards found on page ${pageNum} after waiting. Skipping.`);
      break;
    }
    // Extract jobs from the current page
    const pageJobs = await page.evaluate(() => {
      const jobs = [];
      const cards = document.querySelectorAll('.job-tile');
      cards.forEach(card => {
        const titleEl = card.querySelector('.job-title');
        const linkEl = card.querySelector('a[href*="/jobs/"]');
        const locationEl = card.querySelector('.location-and-id .location');
        const title = titleEl ? titleEl.textContent.trim() : '';
        const link = linkEl ? (linkEl.href.startsWith('http') ? linkEl.href : `https://www.amazon.jobs${linkEl.getAttribute('href')}`) : '';
        const location = locationEl ? locationEl.textContent.trim() : '';
        if (title && link && location) {
          jobs.push({
            title,
            location,
            link,
            company: 'Amazon'
          });
        }
      });
      return jobs;
    });
    // Only add jobs with unique links
    let added = 0;
    for (const job of pageJobs) {
      if (!jobLinks.has(job.link)) {
        jobs.push(job);
        jobLinks.add(job.link);
        added++;
      }
    }
    console.log(`  Found ${pageJobs.length} jobs on page ${pageNum}. Added ${added} new jobs. Total so far: ${jobs.length}`);

    // Find and click the next button
    const nextBtn = await page.$('a.pagination-link[aria-label="Next"]');
    if (nextBtn && pageNum < MAX_PAGES) {
      console.log('  Moving to next page...');
      await nextBtn.click();
      // Wait for job cards to update
      await new Promise(r => setTimeout(r, 2000));
      pageNum++;
    } else {
      if (pageNum >= MAX_PAGES) {
        console.log(`Reached page limit (${MAX_PAGES}). Stopping pagination.`);
      } else {
        console.log('No next page found. Finished reading all pages.');
      }
      hasNext = false;
    }
  }

  console.log(`Extracted ${jobs.length} unique jobs from Amazon.`);

  // Scrape job descriptions for each job in parallel batches using a pool of 40 pages
  async function scrapeJobDetailWithPage(job, page, idx, total) {
    try {
      await setBlockResources(page);
      console.log(`  [${idx + 1}/${total}] Scraping: ${job.title}`);
      await page.goto(job.link, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('.section.description', { timeout: 10000 });
      const description = await page.evaluate(() => {
        const descEl = document.querySelector('.section.description');
        return descEl ? descEl.innerText.trim() : '';
      });
      return { ...job, description };
    } catch (e) {
      console.log(`  [${idx + 1}/${total}] Failed to scrape: ${job.title}`);
      return { ...job, description: '' };
    }
  }

  let detailedJobs = [];
  // Create a pool of 40 pages (tabs)
  const detailPages = [];
  for (let i = 0; i < PARALLEL_JOBS; i++) {
    const detailPage = await browser.newPage();
    await setBlockResources(detailPage);
    detailPages.push(detailPage);
  }
  for (let i = 0; i < jobs.length; i += PARALLEL_JOBS) {
    const batch = jobs.slice(i, i + PARALLEL_JOBS);
    console.log(`Scraping job details for jobs ${i + 1} to ${i + batch.length} of ${jobs.length}`);
    // Only use as many pages as jobs in the batch
    const results = await Promise.all(batch.map((job, idx) => scrapeJobDetailWithPage(job, detailPages[idx], i + idx, jobs.length)));
    detailedJobs = detailedJobs.concat(results);
  }
  // Close all detail pages
  for (const p of detailPages) await p.close();

  console.log('--- Amazon Crawler Finished ---');
  await browser.close();
  return detailedJobs;
}

module.exports = { crawlAmazon }; 