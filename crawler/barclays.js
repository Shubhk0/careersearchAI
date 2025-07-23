const puppeteer = require('puppeteer');

const BASE_URL = 'https://search.jobs.barclays/search-jobs';
const PARALLEL_JOBS = 40;
const MAX_PAGES = 40;

async function crawlBarclays() {
  console.log('--- Starting Barclays Crawler ---');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  let jobs = [];
  let jobLinks = new Set();
  let pageNum = 1;
  let hasNext = true;

  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  // Accept cookies if needed
  try {
    await page.waitForSelector('button', { timeout: 10000 });
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = (await page.evaluate(el => el.textContent, btn)).trim();
      if (/accept/i.test(text)) {
        await btn.click();
        await new Promise(r => setTimeout(r, 1000));
        break;
      }
    }
  } catch {}

  let lastFirstTitle = null;
  while (hasNext && pageNum <= MAX_PAGES) {
    console.log(`Reading page ${pageNum}...`);
    await page.waitForTimeout ? await page.waitForTimeout(1000) : await new Promise(r => setTimeout(r, 1000));
    // Extract jobs from the current page only
    const pageJobs = await page.evaluate(() => {
      const jobs = [];
      const strongs = Array.from(document.querySelectorAll('strong'));
      strongs.forEach(strong => {
        const title = strong.textContent.trim();
        let location = '';
        let posted = '';
        let link = '';
        let card = strong.closest('div');
        if (card) {
          const locEl = card.querySelector('.job-location');
          const dateDiv = card.querySelector('div.job-date');
          const aEl = card.querySelector('a[href]');
          location = locEl ? locEl.textContent.trim() : '';
          if (dateDiv) {
            const span = dateDiv.querySelector('span');
            posted = span ? span.textContent.trim() : dateDiv.textContent.trim();
          }
          link = aEl ? aEl.href : '';
        }
        if (title && link) {
          jobs.push({
            title,
            location,
            link,
            company: 'Barclays',
            // posted, // REMOVE posted key
          });
        }
      });
      return jobs;
    });
    // Filter out non-job entries (e.g., 'Featured story') and jobs without location
    const filteredPageJobs = pageJobs.filter(job => !/featured story/i.test(job.title) && job.location && job.location.trim() !== '');
    // Only add jobs with unique links
    let added = 0;
    for (const job of filteredPageJobs) {
      if (!jobLinks.has(job.link)) {
        jobs.push(job);
        jobLinks.add(job.link);
        added++;
      }
    }
    console.log(`  Found ${filteredPageJobs.length} jobs on page ${pageNum}. Added ${added} new jobs. Total so far: ${jobs.length}`);

    // Check for next page button by .next class
    const nextBtn = await page.$('.next:not([disabled])');
    if (nextBtn && pageNum < MAX_PAGES) {
      // Get the first job title before clicking next
      let firstTitle = await page.evaluate(() => {
        const strong = document.querySelector('strong');
        return strong ? strong.textContent.trim() : null;
      });
      lastFirstTitle = firstTitle;
      console.log('  Moving to next page...');
      await nextBtn.click();
      // Wait for the first job title to change (indicating new page loaded)
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
      if (pageNum >= MAX_PAGES) {
        console.log(`Reached page limit (${MAX_PAGES}). Stopping pagination.`);
      } else {
        console.log('No next page found. Finished reading all pages.');
      }
      hasNext = false;
    }
  }

  console.log(`--- Finished reading all pages. Total jobs before detail scraping: ${jobs.length} ---`);

  // Scrape job descriptions and detail posted date for each job in parallel batches using a pool of 40 pages
  async function scrapeJobDetailWithPage(job, page, idx, total) {
    try {
      console.log(`  [${idx + 1}/${total}] Scraping: ${job.title}`);
      await page.goto(job.link, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('.ats-description', { timeout: 10000 });
      const { description, posted_detail } = await page.evaluate(() => {
        const el = document.querySelector('.ats-description');
        const desc = el ? el.innerText.trim() : '';
        const postedEl = document.querySelector('.job-info-label-text');
        const posted_detail = postedEl ? postedEl.textContent.trim() : '';
        return { description: desc, posted_detail };
      });
      // Remove posted key if present
      const { posted, ...jobNoPosted } = job;
      return { ...jobNoPosted, description, posted_detail };
    } catch (e) {
      const { posted, ...jobNoPosted } = job;
      console.log(`  [${idx + 1}/${total}] Failed to scrape: ${job.title}`);
      return { ...jobNoPosted, description: '', posted_detail: '' };
    }
  }

  let detailedJobs = [];
  // Create a pool of 40 pages (tabs)
  const detailPages = [];
  for (let i = 0; i < PARALLEL_JOBS; i++) {
    detailPages.push(await browser.newPage());
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

  console.log('--- Barclays Crawler Finished ---');
  await browser.close();
  return detailedJobs;
}

module.exports = { crawlBarclays };