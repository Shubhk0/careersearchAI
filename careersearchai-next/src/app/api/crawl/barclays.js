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

export async function crawlBarclays(onJob, { maxPages = 10 } = {}) {
  console.log('--- Starting Barclays Crawler (Serverless Optimized) ---');
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await setBlockResources(page);
    let jobs = [];
    let jobLinks = new Set();
    let pageNum = 1;
    let hasNext = true;
    const BASE_URL = 'https://search.jobs.barclays/search-jobs';
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    // Accept cookies if needed (unchanged)
    try {
      await page.waitForSelector('button', { timeout: 10000 });
      const buttons = await page.$$('button');
      let accepted = false;
      for (const btn of buttons) {
        const text = (await page.evaluate(el => el.textContent, btn)).trim();
        if (/accept/i.test(text)) {
          await btn.click();
          console.log(`Clicked cookie button: '${text}'`);
          accepted = true;
          await new Promise(r => setTimeout(r, 1000));
          break;
        }
      }
      if (!accepted) {
        console.log('No Accept button found.');
      }
    } catch (e) {
      console.log('No cookie dialog detected.');
    }
    let lastFirstTitle = null;
    while (hasNext && pageNum <= maxPages) {
      await page.waitForTimeout ? await page.waitForTimeout(1000) : await new Promise(r => setTimeout(r, 1000));
      const pageJobs = await page.evaluate(() => {
        const jobs = [];
        const strongs = Array.from(document.querySelectorAll('strong'));
        strongs.forEach(strong => {
          const title = strong.textContent.trim();
          let location = '';
          let link = '';
          let card = strong.closest('div');
          if (card) {
            const locEl = card.querySelector('.job-location');
            const aEl = card.querySelector('a[href]');
            location = locEl ? locEl.textContent.trim() : '';
            link = aEl ? aEl.href : '';
          }
          if (title && link) {
            jobs.push({ title, location, link, company: 'Barclays' });
          }
        });
        return jobs;
      });
      const filteredPageJobs = pageJobs.filter(job => !/featured story/i.test(job.title) && job.location && job.location.trim() !== '');
      let added = 0;
      for (const job of filteredPageJobs) {
        if (!jobLinks.has(job.link)) {
          if (onJob) await onJob(job);
          jobs.push(job);
          jobLinks.add(job.link);
          added++;
        }
      }
      // Next page logic (unchanged)
      const nextBtn = await page.$('.next:not([disabled])');
      if (nextBtn && pageNum < maxPages) {
        let firstTitle = await page.evaluate(() => {
          const strong = document.querySelector('strong');
          return strong ? strong.textContent.trim() : null;
        });
        lastFirstTitle = firstTitle;
        await nextBtn.click();
        let maxWait = 20;
        let newPageLoaded = false;
        while (maxWait-- > 0 && !newPageLoaded) {
          await new Promise(r => setTimeout(r, 1000));
          let newFirstTitle = await page.evaluate(() => {
            const strong = document.querySelector('strong');
            return strong ? strong.textContent.trim() : null;
          });
          if (newFirstTitle && newFirstTitle !== lastFirstTitle) newPageLoaded = true;
        }
        pageNum++;
      } else {
        hasNext = false;
      }
    }
    // Detail scraping (unchanged, but use PARALLEL_JOBS=5)
    async function scrapeJobDetailWithPage(job, page, idx, total) {
      try {
        await setBlockResources(page);
        await page.goto(job.link, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('.ats-description', { timeout: 10000 });
        const { description, posted_detail } = await page.evaluate(() => {
          const el = document.querySelector('.ats-description');
          const desc = el ? el.innerText.trim() : '';
          const postedEl = document.querySelector('.job-info-label-text');
          const posted_detail = postedEl ? postedEl.textContent.trim() : '';
          return { description: desc, posted_detail };
        });
        const { posted, ...jobNoPosted } = job;
        return { ...jobNoPosted, description, posted_detail };
      } catch (e) {
        const { posted, ...jobNoPosted } = job;
        return { ...jobNoPosted, description: '', posted_detail: '' };
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