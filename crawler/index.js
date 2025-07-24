const fs = require('fs');
const { crawlBarclays } = require('./barclays');
const { crawlGoogle } = require('./google');
const { crawlAmazon } = require('./amazon');
const { crawlAccenture } = require('./accenture');

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

  if (arg === 'amazon' || arg === 'all') {
    console.log('Crawling Amazon...');
    const amazonJobs = await crawlAmazon();
    allJobs = allJobs.concat(amazonJobs);
  }

  if (arg === 'accenture' || arg === 'all') {
    console.log('Crawling Accenture...');
    const accentureJobs = await crawlAccenture();
    allJobs = allJobs.concat(accentureJobs);
  }

  if (![ 'barclays', 'google', 'amazon', 'accenture', 'all' ].includes(arg)) {
    console.log('Usage: node crawler/index.js [barclays|google|amazon|accenture|all]');
    process.exit(1);
  }

  fs.writeFileSync('jobs.json', JSON.stringify(allJobs, null, 2));
  console.log(`Saved ${allJobs.length} jobs to jobs.json`);
}

main(); 