import { crawlBarclays } from './barclays';
import { crawlGoogle } from './google';
import { crawlAmazon } from './amazon';
import { crawlAccenture } from './accenture';
import { crawlCapgemini } from './capgemini';
import { crawlWipro } from './wipro';
import { createClient } from '@supabase/supabase-js';

function chunkArray(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

export async function orchestrateCrawlers({ companies = 'all' } = {}) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  // Wipro is first so it runs first
  const crawlers = {
    capgemini: { fn: crawlCapgemini, company: 'Capgemini' },
    wipro: { fn: crawlWipro, company: 'Wipro' },
    barclays: { fn: crawlBarclays, company: 'Barclays' },
    google: { fn: crawlGoogle, company: 'Google' },
    amazon: { fn: crawlAmazon, company: 'Amazon' },
    accenture: { fn: crawlAccenture, company: 'Accenture' },
    
  };
  const selected = companies === 'all' ? Object.keys(crawlers) : Array.isArray(companies) ? companies : [companies];
  const perCompany = {};
  const errors = {};
  let deduped = [];
  let upserted = 0;

  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    // Fetch all existing job links from Supabase
    const { data: existingJobs, error: fetchError } = await supabase.from('jobs').select('link');
    const existingLinks = new Set((existingJobs || []).map(j => j.link));
    await Promise.all(selected.map(async (key) => {
      if (!crawlers[key]) {
        errors[key] = `No crawler for: ${key}`;
        return;
      }
      try {
        const companyJobs = await crawlers[key].fn(async (job) => {
          // Only upsert if link does not already exist
          if (!existingLinks.has(job.link)) {
            const { error } = await supabase.from('jobs').upsert([job], { onConflict: 'link' });
            if (!error) {
              upserted++;
              existingLinks.add(job.link); // Add to set to prevent future dups in this run
            }
          }
        });
        perCompany[key] = companyJobs.length;
        // Deduplicate by link within this company
        const seen = new Set();
        const companyDeduped = companyJobs.filter(job => {
          if (!job.link || seen.has(job.link)) return false;
          seen.add(job.link);
          return true;
        });
        deduped = deduped.concat(companyDeduped);
      } catch (e) {
        errors[key] = e.toString();
      }
    }));
  } else {
    // If no Supabase, just crawl and dedupe all jobs
    await Promise.all(selected.map(async (key) => {
      if (!crawlers[key]) {
        errors[key] = `No crawler for: ${key}`;
        return;
      }
      try {
        const companyJobs = await crawlers[key].fn();
        perCompany[key] = companyJobs.length;
        deduped = deduped.concat(companyJobs);
      } catch (e) {
        errors[key] = e.toString();
      }
    }));
    // Deduplicate all jobs
    const seen = new Set();
    deduped = deduped.filter(job => {
      if (!job.link || seen.has(job.link)) return false;
      seen.add(job.link);
      return true;
    });
  }

  return {
    jobs: deduped,
    deduped,
    perCompany,
    upserted,
    errors,
    total: deduped.length
  };
} 