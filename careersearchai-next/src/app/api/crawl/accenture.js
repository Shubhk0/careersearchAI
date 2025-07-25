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

export async function crawlAccenture(onJob, { maxPages = 10 } = {}) {
  console.log('--- Starting Accenture Crawler (Serverless Optimized) ---');
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await setBlockResources(page);
    let jobs = [];
    let jobLinks = new Set();
    let pageNum = 1;
    let hasNext = true;
    const BASE_URL = 'https://www.accenture.com/in-en/careers/jobsearch';
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().slice(0, 10);
    while (hasNext && pageNum <= maxPages) {
      try {
        await page.waitForSelector('.rad-filters-vertical__job-card--open, .rad-filters-vertical__job-card', { timeout: 15000 });
      } catch {
        break;
      }
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
            jobs.push({ title, location, link, company: 'Accenture' });
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
      const nextBtn = await page.$('.rad-icon-button.rad-icon-button--secondary.rad-pagination__next');
      if (nextBtn && pageNum < maxPages) {
        let lastFirstLink = jobs.length ? jobs[jobs.length - pageJobs.length].link : null;
        await nextBtn.click();
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
        hasNext = false;
      }
    }
    async function scrapeJobDetailWithPage(job, page, idx, total) {
      try {
        await setBlockResources(page);
        await page.goto(job.link, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('.rad-job-detail', { timeout: 10000 });
        const description = await page.evaluate(() => {
          const descEl = document.querySelector('.rad-job-detail');
          return descEl ? descEl.innerText.trim() : '';
        });
        return { ...job, description, posted_detail: today };
      } catch (e) {
        return { ...job, description: '', posted_detail: today };
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