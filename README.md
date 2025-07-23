# Career Search AI

A website to search through consolidated job listings from multiple company career pages. Uses a Node.js crawler, a static frontend, and is automated/deployed via GitHub Actions and GitHub Pages.

## Features
- Crawls company career pages and saves jobs to `jobs.json`
- Static frontend (HTML/JS/CSS) for searching jobs
- Automated updates via GitHub Actions
- Hosted on GitHub Pages

## Usage

### 1. Crawler
- Edit `crawler.js` to add your target company career page URLs and customize selectors as needed.
- Run locally:
  ```bash
  npm install
  node crawler.js
  ```
- Output: `jobs.json` (copy to `docs/` for local frontend testing)

### 2. Frontend
- Open `docs/index.html` in your browser (ensure `docs/jobs.json` exists).
- Search/filter jobs client-side.

### 3. GitHub Actions
- `.github/workflows/crawl.yml` runs the crawler on a schedule, commits updated `jobs.json`.

### 4. GitHub Pages
- Set GitHub Pages to serve from the `docs/` folder in repository settings.

## Customization
- Update selectors in `crawler.js` for each company as needed.
- Style the frontend via `docs/styles.css`.

---

**Note:** The crawler is a template. Each company site may require custom selectors for job extraction. 