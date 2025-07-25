const { orchestrateCrawlers } = require('./orchestrator');
const fs = require('fs');

async function main() {
  const arg = process.argv[2] ? process.argv[2].toLowerCase() : 'all';
  const result = await orchestrateCrawlers({ companies: arg });
  fs.writeFileSync('jobs.json', JSON.stringify(result.deduped, null, 2));
  console.log(`Saved ${result.deduped.length} unique jobs to jobs.json`);
  Object.entries(result.perCompany).forEach(([company, count]) => {
    console.log(`${company}: ${count} jobs`);
  });
  if (result.upserted) {
    console.log(`Upserted ${result.upserted} jobs to Supabase`);
  }
  if (Object.keys(result.errors).length > 0) {
    console.log('Errors:', result.errors);
  }
  console.log(`Total unique jobs: ${result.total}`);
}

main(); 