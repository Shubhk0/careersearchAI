import puppeteer from "puppeteer";

const PARALLEL_JOBS = 3;
const MAX_PAGES = 50;
const JOBS_PER_PAGE = 25;

function normalizeUrl(link) {
  if (!link) return '';
  if (link.startsWith('http')) return link;
  return `https://careers.wipro.com${link}`;
}

async function setBlockResources(page) {
  await page.setRequestInterception(true);
  page.removeAllListeners('request');
  page.on('request', (req) => {
    try {
      if (typeof req.isInterceptResolutionHandled === 'function' && req.isInterceptResolutionHandled()) return;
      if ([ 'image', 'stylesheet', 'font' ].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    } catch (err) {}
  });
}

export async function crawlWipro(onJob, { maxPages = 10, headless = true } = {}) {
  console.log('--- Starting Wipro Crawler (robust, retries, validated, serverless) ---');
  let browser;
  let summary = { pages: 0, jobs: 0, upserted: 0, errors: [] };
  try {
    browser = await puppeteer.launch({ headless, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await setBlockResources(page);
    let jobs = [];
    let jobLinks = new Set();
    let pageNum = 1;
    let hasNext = true;
    while (hasNext && pageNum <= Math.min(MAX_PAGES, maxPages)) {
      const startrow = (pageNum - 1) * JOBS_PER_PAGE;
      const url = `https://careers.wipro.com/search/?q=&locationsearch=india&startrow=${startrow}`;
      let retries = 3;
      let pageJobs = [];
      let success = false;
      while (retries-- > 0 && !success) {
        try {
          await page.goto(url, { waitUntil: 'networkidle2' });
          await page.waitForSelector('a[href^="/job/"]', { timeout: 15000 });
          pageJobs = await page.evaluate(() => {
            const jobs = [];
            const jobLinks = document.querySelectorAll('a[href^="/job/"]');
            jobLinks.forEach(linkEl => {
              const title = linkEl.textContent.trim();
              const link = linkEl.href;
              let row = linkEl.closest('tr') || linkEl.closest('.data-row') || linkEl.parentElement;
              let location = '';
              let posted_detail = '';
              if (row) {
                const tds = row.querySelectorAll('td');
                if (tds.length >= 2) {
                  location = tds[1].textContent.trim();
                  if (tds.length >= 3) posted_detail = tds[2].textContent.trim();
                }
                const locEl = row.querySelector('.colLocation');
                const dateEl = row.querySelector('.colPostedDate');
                if (locEl) location = locEl.textContent.trim();
                if (dateEl) posted_detail = dateEl.textContent.trim();
              }
              if (title && link && location) {
                jobs.push({ title, location, link, company: 'Wipro', posted_detail });
              }
            });
            return jobs;
          });
          success = true;
        } catch (err) {
          summary.errors.push(`Page ${pageNum} retry ${3-retries}: ${err}`);
          await page.waitForTimeout(2000);
        }
      }
      if (!success) {
        console.warn(`  Failed to load jobs on page ${pageNum} after retries.`);
        break;
      }
      // Validate and normalize jobs
      let added = 0;
      for (const job of pageJobs) {
        job.link = normalizeUrl(job.link);
        if (!job.title || !job.link || !job.location) continue;
        if (!jobLinks.has(job.link)) {
          if (onJob) await onJob(job);
          jobs.push(job);
          jobLinks.add(job.link);
          added++;
          summary.upserted++;
        }
      }
      summary.pages++;
      summary.jobs += added;
      console.log(`  Found ${pageJobs.length} jobs on page ${pageNum}. Added ${added} new jobs. Total so far: ${jobs.length}`);
      if (pageJobs.length === 0) {
        hasNext = false;
      } else {
        pageNum++;
      }
    }
    // No disk writes, just return jobs and summary
    return { jobs, summary };
  } finally {
    if (browser) await browser.close();
  }
} 