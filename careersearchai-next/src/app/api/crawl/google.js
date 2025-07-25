import puppeteer from "puppeteer";

const PARALLEL_JOBS = 5;

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

export async function crawlGoogle(onJob, { maxPages = 10 } = {}) {
  console.log('--- Starting Google Crawler (Serverless Optimized) ---');
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await setBlockResources(page);
    let jobs = [];
    let jobLinks = new Set();
    let pageNum = 1;
    let hasNext = true;
    const BASE_URL = 'https://careers.google.com/jobs/results/';
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    while (hasNext && pageNum <= maxPages) {
      try {
        await page.waitForSelector('section[data-testid="job-listing"] article', { timeout: 15000 });
      } catch {
        break;
      }
      const pageJobs = await page.evaluate(() => {
        const jobs = [];
        const cards = document.querySelectorAll('section[data-testid="job-listing"] article');
        cards.forEach(card => {
          const titleEl = card.querySelector('h2');
          const linkEl = card.querySelector('a[href*="/jobs/results/"]');
          const locationEl = card.querySelector('[data-testid="job-location"]');
          const title = titleEl ? titleEl.textContent.trim() : '';
          const link = linkEl ? (linkEl.href.startsWith('http') ? linkEl.href : `https://careers.google.com${linkEl.getAttribute('href')}`) : '';
          const location = locationEl ? locationEl.textContent.trim() : '';
          if (title && link && location) {
            jobs.push({ title, location, link, company: 'Google' });
          }
        });
        return jobs;
      });
      let added = 0;
      for (const job of pageJobs) {
        if (!jobLinks.has(job.link)) {
          if (onJob) await onJob(job);
          jobs.push(job);
          jobLinks.add(job.link);
          added++;
        }
      }
      const nextBtn = await page.$('button[aria-label="Next page"]:not([disabled])');
      if (nextBtn && pageNum < maxPages) {
        await nextBtn.click();
        await new Promise(r => setTimeout(r, 2000));
        pageNum++;
      } else {
        hasNext = false;
      }
    }
    async function scrapeJobDetailWithPage(job, page, idx, total) {
      try {
        await setBlockResources(page);
        await page.goto(job.link, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('section[data-testid="job-details"]', { timeout: 10000 });
        const description = await page.evaluate(() => {
          const descEl = document.querySelector('section[data-testid="job-details"]');
          return descEl ? descEl.innerText.trim() : '';
        });
        return { ...job, description };
      } catch (e) {
        return { ...job, description: '' };
      }
    }
    let detailedJobs = [];
    const detailPages = [];
    for (let i = 0; i < PARALLEL_JOBS; i++) {
      const detailPage = await browser.newPage();
      await setBlockResources(detailPage);
      detailPages.push(detailPage);
    }
    for (let i = 0; i < jobs.length; i += PARALLEL_JOBS) {
      const batch = jobs.slice(i, i + PARALLEL_JOBS);
      const results = await Promise.all(batch.map((job, idx) => scrapeJobDetailWithPage(job, detailPages[idx], i + idx, jobs.length)));
      detailedJobs = detailedJobs.concat(results);
    }
    for (const p of detailPages) await p.close();
    return detailedJobs;
  } finally {
    if (browser) await browser.close();
  }
} 