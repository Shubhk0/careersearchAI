const path = require('path');
const fs = require('fs');

async function getCrawlers() {
  const crawlers = {};
  const files = fs.readdirSync(__dirname);
  for (const file of files) {
    if (file === 'index.js' || file === 'orchestrator.js' || !file.endsWith('.js')) continue;
    const mod = require(path.join(__dirname, file));
    for (const key of Object.keys(mod)) {
      if (/^crawl[A-Z]/.test(key) && typeof mod[key] === 'function') {
        const company = key.replace(/^crawl/, '');
        crawlers[company.toLowerCase()] = { fn: mod[key], company };
      }
    }
  }
  return crawlers;
}

async function orchestrateCrawlers({ companies = 'all' } = {}) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const crawlers = await getCrawlers();
  const selected = companies === 'all' ? Object.keys(crawlers) : Array.isArray(companies) ? companies : [companies];
  const perCompany = {};
  const errors = {};
  const results = await Promise.all(selected.map(async (key) => {
    if (!crawlers[key]) {
      errors[key] = `No crawler for: ${key}`;
      return [];
    }
    try {
      const jobs = await crawlers[key].fn();
      perCompany[key] = jobs.length;
      return jobs;
    } catch (e) {
      errors[key] = e.toString();
      return [];
    }
  }));
  const jobs = results.flat();
  // Deduplicate by link
  const seen = new Set();
  const deduped = jobs.filter(job => {
    if (!job.link || seen.has(job.link)) return false;
    seen.add(job.link);
    return true;
  });
  let upserted = 0;
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      for (const job of deduped) {
        const { error } = await supabase.from('jobs').upsert([job], { onConflict: 'link' });
        if (!error) upserted++;
      }
    } catch (e) {
      errors['supabase'] = e.toString();
    }
  }
  return {
    jobs,
    deduped,
    perCompany,
    upserted,
    errors,
    total: deduped.length
  };
}

module.exports = { orchestrateCrawlers }; 