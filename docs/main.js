// --- Three.js Futuristic Background ---
const canvas = document.getElementById('bg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.z = 50;

// Create moving particles
const particles = [];
const geometry = new THREE.SphereGeometry(0.5, 8, 8);
const material = new THREE.MeshBasicMaterial({ color: 0x00fff7 });
for (let i = 0; i < 120; i++) {
  const mesh = new THREE.Mesh(geometry, material.clone());
  mesh.position.set(
    (Math.random() - 0.5) * 100,
    (Math.random() - 0.5) * 60,
    (Math.random() - 0.5) * 80
  );
  mesh.material.color.setHSL(Math.random(), 1, 0.6);
  scene.add(mesh);
  particles.push(mesh);
}
function animateBG() {
  requestAnimationFrame(animateBG);
  particles.forEach((p, i) => {
    p.position.x += Math.sin(Date.now() * 0.0005 + i) * 0.01;
    p.position.y += Math.cos(Date.now() * 0.0007 + i) * 0.01;
  });
  renderer.render(scene, camera);
}
animateBG();
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// --- End Three.js ---

let jobs = [];
let filteredJobs = [];
let currentLocation = '';

async function loadJobs() {
  try {
    const res = await fetch('jobs.json');
    jobs = await res.json();
    populateLocationFilter(jobs);
    filteredJobs = jobs;
    renderJobs(filteredJobs);
  } catch (e) {
    document.getElementById('jobs-list').innerHTML = '<p>Could not load jobs.</p>';
  }
}

function populateLocationFilter(jobs) {
  const select = document.getElementById('location-filter');
  const locations = Array.from(new Set(jobs.map(j => j.location).filter(Boolean))).sort();
  select.innerHTML = '<option value="">All Locations</option>' +
    locations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
}

function animateJobCards() {
  anime({
    targets: '.job-card',
    translateY: [40, 0],
    opacity: [0, 1],
    delay: anime.stagger(60),
    duration: 700,
    easing: 'easeOutExpo'
  });
}

function renderJobs(jobsToRender) {
  const container = document.getElementById('jobs-list');
  if (!jobsToRender.length) {
    container.innerHTML = '<p>No jobs found.</p>';
    return;
  }
  container.innerHTML = jobsToRender.map((job, idx) => `
    <div class="job-card">
      <h2>${job.title}</h2>
      <div class="job-meta">
        <span><strong>Company:</strong> ${job.company}</span>
        <span><strong>Location:</strong> ${job.location}</span>
        ${job.posted_detail ? `<span><strong>Posted (Detail):</strong> ${job.posted_detail}</span>` : ''}
      </div>
      <a href="${job.link}" target="_blank">View Job</a>
      ${job.description ? `<button class="desc-btn" data-idx="${idx}">View Description</button>` : ''}
    </div>
  `).join('');

  // Add event listeners for description buttons
  document.querySelectorAll('.desc-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.getAttribute('data-idx');
      showModal(jobsToRender[idx]);
    });
  });
  animateJobCards();
}

document.getElementById('search').addEventListener('input', function(e) {
  const q = e.target.value.toLowerCase();
  // Reset location filter to 'All Locations' on search
  document.getElementById('location-filter').value = '';
  currentLocation = '';
  filteredJobs = jobs.filter(job =>
    job.title.toLowerCase().includes(q) ||
    job.company.toLowerCase().includes(q) ||
    job.location.toLowerCase().includes(q)
  );
  renderJobs(filteredJobs);
});

document.getElementById('location-filter').addEventListener('change', function(e) {
  currentLocation = this.value;
  const q = document.getElementById('search').value.toLowerCase();
  filteredJobs = jobs.filter(job => {
    const matchesLocation = !currentLocation || job.location === currentLocation;
    const matchesSearch =
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q);
    return matchesLocation && matchesSearch;
  });
  renderJobs(filteredJobs);
});

function showModal(job) {
  const modal = document.getElementById('job-modal');
  const content = document.getElementById('modal-job-content');
  content.innerHTML = `
    <h2>${job.title}</h2>
    <div class="job-meta">
      <span><strong>Company:</strong> ${job.company}</span>
      <span><strong>Location:</strong> ${job.location}</span>
      ${job.posted_detail ? `<span><strong>Posted (Detail):</strong> ${job.posted_detail}</span>` : ''}
    </div>
    <div style="margin-top:18px;white-space:pre-line;">
      <strong>Description:</strong><br/>
      ${job.description ? job.description : '<em>No description available.</em>'}
    </div>
    <a href="${job.link}" target="_blank" style="display:block;margin-top:18px;">View Job Posting</a>
  `;
  modal.classList.remove('hidden');
  anime({
    targets: '.modal-content',
    scale: [0.8, 1],
    opacity: [0, 1],
    duration: 400,
    easing: 'easeOutBack'
  });
}

document.getElementById('close-modal').onclick = function() {
  document.getElementById('job-modal').classList.add('hidden');
};
window.onclick = function(event) {
  const modal = document.getElementById('job-modal');
  if (event.target === modal) {
    modal.classList.add('hidden');
  }
};

window.onload = function() {
  loadJobs();
  anime({
    targets: '.main-header h1',
    letterSpacing: ['0em', '0.1em'],
    opacity: [0, 1],
    duration: 1200,
    easing: 'easeOutExpo'
  });
}; 