const fs = require('fs');
const puppeteer = require('puppeteer');

const BASE_URL = 'https://search.jobs.barclays/search-jobs';
const PARALLEL_JOBS = 5; // Number of job detail pages to scrape in parallel

async function scrapeBarclaysJobs() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  let jobs = [];
  let pageNum = 1;
  let hasNext = true;
  let debugDone = false;

  while (hasNext) {
    const url = `${BASE_URL}?page=${pageNum}`;
    console.log(`Visiting: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Try to accept cookies if the dialog appears (case-insensitive, robust)
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
        console.log('No Accept button found. Button texts:', await Promise.all(buttons.map(btn => page.evaluate(el => el.textContent, btn))));
      }
    } catch (e) {
      console.log('No cookie dialog detected.');
    }

    // Wait for job cards to appear
    await page.waitForTimeout ? await page.waitForTimeout(2000) : await new Promise(r => setTimeout(r, 2000));

    // Debug: save screenshot and HTML of first page
    if (!debugDone) {
      await page.screenshot({ path: 'debug-barclays.png', fullPage: true });
      const html = await page.content();
      fs.writeFileSync('debug-barclays.html', html);
      debugDone = true;
    }

    // Extract jobs using <strong> as job title, .job-location, and div.job-date (or its child span)
    const pageJobs = await page.evaluate(() => {
      const jobs = [];
      const strongs = Array.from(document.querySelectorAll('strong'));
      strongs.forEach(strong => {
        const title = strong.textContent.trim();
        let location = '';
        let posted = '';
        let link = '';
        // Find the closest ancestor div (job card)
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
            posted
          });
        }
      });
      return jobs;
    });
    console.log(`Extracted ${pageJobs.length} jobs on page ${pageNum}`);
    if (pageNum === 1) console.log('Sample jobs:', pageJobs.slice(0, 3));
    jobs = jobs.concat(pageJobs);
    // Try to find next page
    hasNext = await page.$('[aria-label="Next Page"]:not([disabled])') !== null;
    pageNum++;
  }

  // Scrape job descriptions and detail posted date for each job in parallel batches
  async function scrapeJobDetail(job) {
    try {
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const jobDetailPage = await browser.newPage();
      await jobDetailPage.goto(job.link, { waitUntil: 'networkidle2', timeout: 30000 });
      await jobDetailPage.waitForSelector('.ats-description', { timeout: 10000 });
      const { description, posted_detail } = await jobDetailPage.evaluate(() => {
        const el = document.querySelector('.ats-description');
        const desc = el ? el.innerText.trim() : '';
        const postedEl = document.querySelector('.job-info-label-text');
        const posted_detail = postedEl ? postedEl.textContent.trim() : '';
        return { description: desc, posted_detail };
      });
      await jobDetailPage.close();
      await browser.close();
      return { ...job, description, posted_detail };
    } catch (e) {
      console.log(`Failed to scrape description or posted date for job: ${job.title}`);
      return { ...job, description: '', posted_detail: '' };
    }
  }

  let detailedJobs = [];
  for (let i = 0; i < jobs.length; i += PARALLEL_JOBS) {
    const batch = jobs.slice(i, i + PARALLEL_JOBS);
    console.log(`Scraping job details for jobs ${i + 1} to ${i + batch.length} of ${jobs.length}`);
    const results = await Promise.all(batch.map(scrapeJobDetail));
    detailedJobs = detailedJobs.concat(results);
  }

  await browser.close();
  return detailedJobs;
}

(async () => {
  const jobs = await scrapeBarclaysJobs();
  fs.writeFileSync('jobs.json', JSON.stringify(jobs, null, 2));
  console.log(`Saved ${jobs.length} Barclays jobs to jobs.json`);
})(); 