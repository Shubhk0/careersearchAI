const puppeteer = require('puppeteer');

const BASE_URL = 'https://www.accenture.com/in-en/careers/jobsearch';
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

async function crawlAccenture() {
  console.log('--- Starting Accenture Crawler ---');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await setBlockResources(page);
  let jobs = [];
  let jobLinks = new Set();
  let pageNum = 1;
  let hasNext = true;

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().slice(0, 10);

  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  while (hasNext && pageNum <= MAX_PAGES) {
    console.log(`Reading page ${pageNum}...`);
    try {
      await page.waitForSelector('.rad-filters-vertical__job-card--open, .rad-filters-vertical__job-card', { timeout: 15000 });
    } catch {
      console.warn(`  No job cards found on page ${pageNum} after waiting. Skipping.`);
      break;
    }
    // Extract jobs from the current page using both card classes
    const pageJobs = await page.evaluate(() => {
      const jobs = [];
      const cards = document.querySelectorAll('.rad-filters-vertical__job-card--open, .rad-filters-vertical__job-card');
      cards.forEach(card => {
        const titleEl = card.querySelector('.rad-filters-vertical__job-card-title');
        const linkEl = card.querySelector('a[href*="/in-en/careers/jobdetails"]');
        const locationEl = card.querySelector('.job-location, .location, [data-job-location], span[class*="location"], div[class*="location"]');
        const title = titleEl ? titleEl.textContent.trim() : '';
        const link = linkEl ? (linkEl.href.startsWith('http') ? linkEl.href : `https://www.accenture.com${linkEl.getAttribute('href')}`) : '';
        const location = locationEl ? locationEl.textContent.trim() : '';
        if (title && link && location) {
          jobs.push({
            title,
            location,
            link,
            company: 'Accenture'
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

    // Find and click the next button by its class
    const nextBtn = await page.$('.rad-icon-button.rad-icon-button--secondary.rad-pagination__next');
    if (nextBtn && pageNum < MAX_PAGES) {
      console.log('  Moving to next page...');
      // Get the first job link before clicking next
      let lastFirstLink = jobs.length ? jobs[jobs.length - pageJobs.length].link : null;
      await nextBtn.click();
      // Wait for job cards to update (wait for first job link to change)
      let maxWait = 20;
      let newPageLoaded = false;
      while (maxWait-- > 0 && !newPageLoaded) {
        await new Promise(r => setTimeout(r, 1000));
        let newFirstLink = await page.evaluate(() => {
          const card = document.querySelector('.rad-filters-vertical__job-card--open a[href*="/in-en/careers/jobdetails"], .rad-filters-vertical__job-card a[href*="/in-en/careers/jobdetails"]');
          return card ? card.href : null;
        });
        if (newFirstLink && newFirstLink !== lastFirstLink) newPageLoaded = true;
      }
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

  console.log(`Extracted ${jobs.length} unique jobs from Accenture.`);

  // Scrape job descriptions for each job in parallel batches using a pool of 40 pages
  async function scrapeJobDetailWithPage(job, page, idx, total) {
    try {
      await setBlockResources(page);
      console.log(`  [${idx + 1}/${total}] Scraping: ${job.title}`);
      await page.goto(job.link, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('.rad-job-detail', { timeout: 10000 });
      const description = await page.evaluate(() => {
        const descEl = document.querySelector('.rad-job-detail');
        return descEl ? descEl.innerText.trim() : '';
      });
      return { ...job, description, posted_detail: today };
    } catch (e) {
      console.log(`  [${idx + 1}/${total}] Failed to scrape: ${job.title}`);
      return { ...job, description: '', posted_detail: today };
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

  console.log('--- Accenture Crawler Finished ---');
  await browser.close();
  return detailedJobs;
}

module.exports = { crawlAccenture }; 