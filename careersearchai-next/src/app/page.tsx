"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [modalJob, setModalJob] = useState<any | null>(null);

  useEffect(() => {
    async function fetchJobs() {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('posted_detail', { ascending: false });
      if (!error && data) setJobs(data);
      setLoading(false);
    }
    fetchJobs();
  }, []);

  const locations = Array.from(new Set(jobs.map(j => j.location).filter(Boolean))).sort();

  const filteredJobs = jobs.filter(job =>
    (!search ||
      job.title?.toLowerCase().includes(search.toLowerCase()) ||
      job.company?.toLowerCase().includes(search.toLowerCase()) ||
      job.location?.toLowerCase().includes(search.toLowerCase())
    ) &&
    (!location || job.location === location)
  );

  return (
    <div className="modern-bg">
      <div className="modern-container">
        <h1 className="modern-title">Career Search AI</h1>
        <div className="modern-filters">
          <input
            type="text"
            placeholder="🔍 Search for jobs, companies, or locations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="modern-input"
          />
          <select
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="modern-select"
          >
            <option value="">All Locations</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className="modern-loading">Loading jobs...</p>
        ) : filteredJobs.length === 0 ? (
          <p className="modern-nojobs">No jobs found.</p>
        ) : (
          <div className="modern-jobs-grid">
            {filteredJobs.map((job, idx) => (
              <div
                className="modern-card"
                key={job.id || idx}
                onClick={() => setModalJob(job)}
              >
                <div className="modern-card-header">
                  <div className="modern-logo">{job.company?.[0] || "?"}</div>
                  <span className="modern-company">{job.company}</span>
                </div>
                <h2 className="modern-card-title">{job.title}</h2>
                <div className="modern-card-meta">
                  <span><strong>Location:</strong> {job.location}</span>
                  {job.posted_detail && (
                    <span><strong>Posted:</strong> {job.posted_detail}</span>
                  )}
                </div>
                <a
                  href={job.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modern-link"
                  onClick={e => e.stopPropagation()}
                >
                  View Job
                </a>
                {job.description && (
                  <button
                    className="modern-desc-btn"
                    onClick={e => { e.stopPropagation(); setModalJob(job); }}
                  >
                    View Description
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {modalJob && (
        <div className="modern-modal-overlay" onClick={() => setModalJob(null)}>
          <div className="modern-modal" onClick={e => e.stopPropagation()}>
            <button className="modern-close-btn" onClick={() => setModalJob(null)}>&times;</button>
            <h2 className="modern-modal-title">{modalJob.title}</h2>
            <div className="modern-modal-meta">
              <span><strong>Company:</strong> {modalJob.company}</span><br />
              <span><strong>Location:</strong> {modalJob.location}</span><br />
              {modalJob.posted_detail && (
                <span><strong>Posted:</strong> {modalJob.posted_detail}</span>
              )}
            </div>
            <div className="modern-modal-desc">
              <strong>Description:</strong><br />
              {modalJob.description || <em>No description available.</em>}
            </div>
            <a
              href={modalJob.link}
              target="_blank"
              rel="noopener noreferrer"
              className="modern-link"
            >
              View Job Posting
            </a>
          </div>
        </div>
      )}
      <style jsx global>{`
        body, html { margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; }
        .modern-bg {
          min-height: 100vh;
          background: linear-gradient(120deg, #232526 0%, #414345 50%, #232526 100%);
          background-size: 200% 200%;
          animation: gradientMove 8s ease-in-out infinite;
        }
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .modern-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 16px;
        }
        .modern-title {
          font-size: 3rem;
          font-weight: 900;
          text-align: center;
          color: #fff;
          margin-bottom: 2.5rem;
          letter-spacing: -1px;
          text-shadow: 0 4px 24px #0004;
        }
        .modern-filters {
          display: flex;
          flex-direction: row;
          gap: 16px;
          margin-bottom: 40px;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
        }
        .modern-input, .modern-select {
          border: 1.5px solid #3bc9db;
          border-radius: 10px;
          padding: 12px 18px;
          font-size: 1rem;
          background: rgba(30,34,44,0.92);
          color: #fff;
          outline: none;
          transition: border 0.2s;
        }
        .modern-input:focus, .modern-select:focus {
          border-color: #38d9a9;
        }
        .modern-jobs-grid {
          display: grid;
          gap: 32px;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
        }
        .modern-card {
          background: rgba(30,34,44,0.98);
          border-radius: 18px;
          box-shadow: 0 8px 32px #00e6ff22, 0 1.5px 8px #0002;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border: 1.5px solid #3bc9db;
          transition: transform 0.18s, box-shadow 0.18s;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .modern-card:hover {
          transform: scale(1.035);
          box-shadow: 0 8px 48px #3bc9db55, 0 1.5px 8px #0002;
        }
        .modern-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 6px;
        }
        .modern-logo {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3bc9db 0%, #38d9a9 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 1.3rem;
          box-shadow: 0 2px 8px #00e6ff33;
        }
        .modern-company {
          color: #3bc9db;
          font-size: 1.1rem;
          font-weight: 600;
        }
        .modern-card-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 2px;
        }
        .modern-card-meta {
          color: #b2f2ff;
          font-size: 1rem;
          margin-bottom: 4px;
        }
        .modern-link {
          color: #3bc9db;
          font-weight: 500;
          text-decoration: underline;
          margin-top: 6px;
          margin-bottom: 2px;
          font-size: 1rem;
          transition: color 0.18s;
        }
        .modern-link:hover {
          color: #38d9a9;
        }
        .modern-desc-btn {
          margin-top: 8px;
          padding: 8px 18px;
          background: linear-gradient(90deg, #3bc9db 0%, #38d9a9 100%);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          align-self: flex-start;
          transition: background 0.18s;
        }
        .modern-desc-btn:hover {
          background: linear-gradient(90deg, #38d9a9 0%, #3bc9db 100%);
        }
        .modern-loading, .modern-nojobs {
          color: #3bc9db;
          text-align: center;
          font-size: 1.2rem;
        }
        .modern-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modern-modal {
          background: rgba(30,34,44,0.98);
          border-radius: 18px;
          padding: 36px;
          max-width: 520px;
          width: 95vw;
          box-shadow: 0 8px 32px #00e6ff33, 0 1.5px 8px #0002;
          position: relative;
          animation: modalPop 0.35s cubic-bezier(.68,-0.55,.27,1.55);
        }
        @keyframes modalPop {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .modern-close-btn {
          position: absolute;
          top: 16px;
          right: 22px;
          font-size: 2rem;
          color: #3bc9db;
          cursor: pointer;
          font-weight: 700;
          background: none;
          border: none;
        }
        .modern-modal-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #3bc9db;
          margin-bottom: 8px;
        }
        .modern-modal-meta {
          color: #b2f2ff;
          font-size: 1rem;
          margin-bottom: 8px;
        }
        .modern-modal-desc {
          margin-top: 18px;
          white-space: pre-line;
          font-size: 1rem;
          color: #fff;
        }
        .modern-modal a {
          display: block;
          margin-top: 18px;
        }
        @media (max-width: 600px) {
          .modern-title { font-size: 2rem; }
          .modern-container { padding: 20px 4px; }
          .modern-card { padding: 16px; }
        }
      `}</style>
    </div>
  );
}
