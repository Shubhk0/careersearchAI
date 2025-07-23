const fs = require('fs');
const { crawlBarclays } = require('./barclays');
const { crawlGoogle } = require('./google');

async function main() {
  let allJobs = [];
  const arg = process.argv[2] ? process.argv[2].toLowerCase() : 'all';

  if (arg === 'barclays' || arg === 'all') {
    console.log('Crawling Barclays...');
    const barclaysJobs = await crawlBarclays();
    allJobs = allJobs.concat(barclaysJobs);
  }

  if (arg === 'google' || arg === 'all') {
    console.log('Crawling Google...');
    const googleJobs = await crawlGoogle();
    allJobs = allJobs.concat(googleJobs);
  }

  if (arg !== 'barclays' && arg !== 'google' && arg !== 'all') {
    console.log('Usage: node crawler/index.js [barclays|google|all]');
    process.exit(1);
  }

  fs.writeFileSync('jobs.json', JSON.stringify(allJobs, null, 2));
  console.log(`Saved ${allJobs.length} jobs to jobs.json`);
}

main(); 