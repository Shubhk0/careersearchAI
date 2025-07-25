import puppeteer from "puppeteer";

const PARALLEL_JOBS = 3;
const MAX_PAGES = 50;
const JOBS_PER_PAGE = 12;

function normalizeUrl(link) {
  if (!link) return '';
  if (link.startsWith('http')) return link;
  return link.startsWith('/') ? `https://www.capgemini.com${link}` : link;
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

export async function crawlCapgemini(onJob, { maxPages = 10, headless = true } = {}) {
  console.log('--- Starting Capgemini Crawler (robust, retries, validated, serverless) ---');
  let browser;
  let summary = { pages: 0, jobs: 0, upserted: 0, errors: [] };
  try {
    browser = await puppeteer.launch({ headless, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await setBlockResources(page);
    let jobs = [];
    let jobLinks = new Set();
    const BASE_URL = `https://www.capgemini.com/in-en/careers/join-capgemini/job-search/?page=1&size=${JOBS_PER_PAGE}&country_code=in-en`;
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    let totalPages = 1;
    try {
      await page.waitForSelector('.pagination', { timeout: 10000 });
      totalPages = await page.evaluate(() => {
        const pagin = document.querySelector('.pagination');
        if (!pagin) return 1;
        const pageLinks = Array.from(pagin.querySelectorAll('a, button')).map(el => el.textContent.trim()).filter(t => /^\d+$/.test(t));
        const nums = pageLinks.map(Number);
        return nums.length ? Math.max(...nums) : 1;
      });
    } catch {
      totalPages = 1;
    }
    totalPages = Math.min(totalPages, MAX_PAGES, maxPages);
    console.log(`  Detected total pages: ${totalPages}`);
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const url = `https://www.capgemini.com/in-en/careers/join-capgemini/job-search/?page=${pageNum}&size=${JOBS_PER_PAGE}&country_code=in-en`;
      let retries = 3;
      let pageJobs = [];
      let success = false;
      while (retries-- > 0 && !success) {
        try {
          await page.goto(url, { waitUntil: 'networkidle2' });
          await page.waitForSelector('.JobRow-module__job-card___riAUE', { timeout: 20000 });
          await page.waitForTimeout(2000);
          pageJobs = await page.evaluate(() => {
            const jobs = [];
            const cards = document.querySelectorAll('.JobRow-module__job-card___riAUE');
            cards.forEach(card => {
              const titleEl = card.querySelector('a, [data-automation-id="job-title"]');
              const title = titleEl ? titleEl.textContent.trim() : '';
              const link = titleEl && titleEl.href ? titleEl.href : '';
              let location = '';
              const locEl = card.querySelector('[data-automation-id="job-location"]') || card.querySelector('.job-listing__location');
              if (locEl) location = locEl.textContent.trim();
              if (title && link && location) {
                jobs.push({ title, location, link, company: 'Capgemini' });
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
      if (pageJobs.length === 0) break;
    }
    return { jobs, summary };
  } finally {
    if (browser) await browser.close();
  }
} 