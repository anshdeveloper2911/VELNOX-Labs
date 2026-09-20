import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_FILE = path.resolve(__dirname, process.env.DB_FILE || './data/velnox.db');
const JWT_SECRET = process.env.JWT_SECRET || 'velnox-local-secret-change-me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'velnox123';
const configuredOrigins = String(process.env.CORS_ORIGINS || '*').split(',').map(v => v.trim()).filter(Boolean);

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const SQL = await initSqlJs({
  locateFile: file => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
});

let db;
try {
  db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
} catch (error) {
  console.error('Database open failed, creating a fresh database:', error.message);
  db = new SQL.Database();
}

function saveDb() {
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, DB_FILE);
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function one(sql, params = []) {
  return all(sql, params)[0] || null;
}

function clean(value, max = 5000) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function int(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

function isValidId(value) {
  return /^\d+$/.test(String(value));
}

function sendError(res, status, message) {
  return res.status(status).json({ ok: false, error: message });
}

run(`CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT DEFAULT '',
  url TEXT DEFAULT '',
  meta TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  published INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);
run(`CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  quote TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  published INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);
run(`CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  service TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);
run(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

// Lightweight migrations for databases created by older VELNOX builds.
for (const statement of [
  'ALTER TABLE projects ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP',
  'ALTER TABLE testimonials ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP',
  'ALTER TABLE enquiries ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP'
]) {
  try { db.run(statement); saveDb(); } catch { /* column already exists */ }
}

if (!one('SELECT id FROM projects LIMIT 1')) {
  const seeds = [
    ['VELNOX Food', 'SELF INITIATED', 'A modern food ordering experience designed with a clean interface, smooth interactions and a premium visual system.', '/assets/veloxfood.png', 'https://anshdeveloper2911.github.io/velnox-food/', 'Web Development|Brand Website', 1, 1],
    ['Helping Hands Foundation', 'CLIENT PROJECT', 'A community-focused website built for a student-led NGO, showcasing humanitarian initiatives, community work, volunteering and social impact.', '/assets/helping-hands.png', 'https://helping-hand-asansol.vercel.app/', 'Web Development|NGO Website', 2, 1],
    ['Digital Studio', 'UI / UX CONCEPT', 'A creative digital experience focused on strong typography, visual hierarchy and modern interaction design.', '', '', 'UI / UX|Creative Design', 3, 1],
    ['Next Experiment', 'IN DEVELOPMENT', 'New ideas, technologies and digital products currently being explored.', '', '', 'Product|Experiment', 4, 1]
  ];
  for (const project of seeds) {
    run('INSERT INTO projects(title,type,description,image,url,meta,sort_order,published) VALUES(?,?,?,?,?,?,?,?)', project);
  }
}

if (!one('SELECT id FROM testimonials LIMIT 1')) {
  run('INSERT INTO testimonials(name,role,quote,rating,published) VALUES(?,?,?,?,?)', [
    'VELNOX Client', 'Project Client',
    'VELNOX understood the requirement properly and completed the project on time.', 5, 1
  ]);
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'http:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes('*') || configuredOrigins.includes(origin)) return callback(null, true);
    // Always allow local development ports so npx serve's random port cannot break the API.
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
    return callback(new Error('CORS origin blocked'));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please try again later.' }
});
app.use('/api/', publicLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { ok: false, error: 'Too many login attempts. Please wait 15 minutes.' }
});

function auth(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return sendError(res, 401, 'Authentication required.');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return sendError(res, 401, 'Session expired. Please log in again.');
  }
}

app.get('/api/health', (req, res) => res.json({
  ok: true,
  service: 'VELNOX Backend',
  version: '2.0.0',
  database: fs.existsSync(DB_FILE) ? 'connected' : 'new',
  time: new Date().toISOString()
}));

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const username = clean(req.body?.username, 100);
  const password = clean(req.body?.password, 200);
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) return sendError(res, 401, 'Invalid username or password.');
  const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  return res.json({ ok: true, token, username, expiresIn: 43200 });
});

app.post('/api/ai/chat', async (req, res) => {
  const message = clean(req.body?.message, 1200);
  if (!message) return sendError(res, 400, 'Message is required.');
  const key = process.env.GEMINI_API_KEY;
  if (!key) return sendError(res, 503, 'AI is not configured yet. Add GEMINI_API_KEY on the server.');
  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `You are VELNOX AI, a concise and helpful assistant for VELNOX Web Labs. Answer safely and clearly. User: ${message}` }] }] })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error:', response.status, data?.error?.message || data);
      return sendError(res, 502, data?.error?.message || `Gemini request failed (${response.status}).`);
    }
    const reply = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!reply) return sendError(res, 502, 'The AI returned an empty response.');
    return res.json({ ok: true, reply });
  } catch (error) {
    return sendError(res, 502, 'AI service is temporarily unavailable.');
  }
});

app.get('/api/projects', (req, res) => res.json(all('SELECT * FROM projects WHERE published=1 ORDER BY sort_order ASC, id ASC')));
app.get('/api/testimonials', (req, res) => res.json(all('SELECT * FROM testimonials WHERE published=1 ORDER BY id DESC')));

app.post('/api/enquiries', (req, res) => {
  const honey = clean(req.body?.honey, 100);
  if (honey) return sendError(res, 400, 'Invalid submission.');
  const name = clean(req.body?.name, 120);
  const email = clean(req.body?.email, 180).toLowerCase();
  const phone = clean(req.body?.phone, 50);
  const service = clean(req.body?.service, 120);
  const message = clean(req.body?.message, 5000);
  if (!name || !service || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendError(res, 400, 'Please fill all required fields correctly.');
  }
  run('INSERT INTO enquiries(name,email,phone,service,message,status) VALUES(?,?,?,?,?,?)', [name, email, phone, service, message, 'new']);
  return res.status(201).json({ ok: true, message: 'Enquiry received successfully.' });
});

app.get('/api/admin/stats', auth, (req, res) => {
  const count = table => Number(one(`SELECT COUNT(*) AS c FROM ${table}`)?.c || 0);
  return res.json({
    ok: true,
    enquiries: count('enquiries'),
    newEnquiries: Number(one("SELECT COUNT(*) AS c FROM enquiries WHERE status='new'")?.c || 0),
    projects: count('projects'),
    publishedProjects: Number(one('SELECT COUNT(*) AS c FROM projects WHERE published=1')?.c || 0),
    testimonials: count('testimonials'),
    publishedTestimonials: Number(one('SELECT COUNT(*) AS c FROM testimonials WHERE published=1')?.c || 0)
  });
});

app.get('/api/admin/enquiries', auth, (req, res) => res.json(all('SELECT * FROM enquiries ORDER BY id DESC')));
app.patch('/api/admin/enquiries/:id', auth, (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid enquiry id.');
  const status = ['new', 'contacted', 'closed'].includes(clean(req.body?.status, 30)) ? clean(req.body.status, 30) : null;
  if (!status) return sendError(res, 400, 'Invalid status.');
  run('UPDATE enquiries SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, int(req.params.id)]);
  return res.json({ ok: true });
});
app.delete('/api/admin/enquiries/:id', auth, (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid enquiry id.');
  run('DELETE FROM enquiries WHERE id=?', [int(req.params.id)]);
  return res.json({ ok: true });
});

app.get('/api/admin/projects', auth, (req, res) => res.json(all('SELECT * FROM projects ORDER BY sort_order ASC, id ASC')));
app.post('/api/admin/projects', auth, (req, res) => {
  const project = [
    clean(req.body?.title, 160), clean(req.body?.type, 100), clean(req.body?.description, 5000),
    clean(req.body?.image, 1000), clean(req.body?.url, 1000), clean(req.body?.meta, 500),
    int(req.body?.sort_order), bool(req.body?.published, true) ? 1 : 0
  ];
  if (!project[0] || !project[1] || !project[2]) return sendError(res, 400, 'Title, type and description are required.');
  run('INSERT INTO projects(title,type,description,image,url,meta,sort_order,published) VALUES(?,?,?,?,?,?,?,?)', project);
  return res.status(201).json(one('SELECT * FROM projects ORDER BY id DESC LIMIT 1'));
});
app.patch('/api/admin/projects/:id', auth, (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid project id.');
  const id = int(req.params.id);
  const existing = one('SELECT * FROM projects WHERE id=?', [id]);
  if (!existing) return sendError(res, 404, 'Project not found.');
  const project = [
    clean(req.body?.title ?? existing.title, 160), clean(req.body?.type ?? existing.type, 100),
    clean(req.body?.description ?? existing.description, 5000), clean(req.body?.image ?? existing.image, 1000),
    clean(req.body?.url ?? existing.url, 1000), clean(req.body?.meta ?? existing.meta, 500),
    int(req.body?.sort_order ?? existing.sort_order), bool(req.body?.published, Boolean(existing.published)) ? 1 : 0, id
  ];
  if (!project[0] || !project[1] || !project[2]) return sendError(res, 400, 'Title, type and description are required.');
  run('UPDATE projects SET title=?,type=?,description=?,image=?,url=?,meta=?,sort_order=?,published=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', project);
  return res.json(one('SELECT * FROM projects WHERE id=?', [id]));
});
app.delete('/api/admin/projects/:id', auth, (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid project id.');
  run('DELETE FROM projects WHERE id=?', [int(req.params.id)]);
  return res.json({ ok: true });
});

app.get('/api/admin/testimonials', auth, (req, res) => res.json(all('SELECT * FROM testimonials ORDER BY id DESC')));
app.post('/api/admin/testimonials', auth, (req, res) => {
  const name = clean(req.body?.name, 160);
  const role = clean(req.body?.role, 160);
  const quote = clean(req.body?.quote, 3000);
  const rating = Math.min(5, Math.max(1, int(req.body?.rating, 5)));
  const published = bool(req.body?.published, true) ? 1 : 0;
  if (!name || !quote) return sendError(res, 400, 'Name and quote are required.');
  run('INSERT INTO testimonials(name,role,quote,rating,published) VALUES(?,?,?,?,?)', [name, role, quote, rating, published]);
  return res.status(201).json(one('SELECT * FROM testimonials ORDER BY id DESC LIMIT 1'));
});
app.patch('/api/admin/testimonials/:id', auth, (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid testimonial id.');
  const id = int(req.params.id);
  const existing = one('SELECT * FROM testimonials WHERE id=?', [id]);
  if (!existing) return sendError(res, 404, 'Testimonial not found.');
  const values = [
    clean(req.body?.name ?? existing.name, 160), clean(req.body?.role ?? existing.role, 160),
    clean(req.body?.quote ?? existing.quote, 3000), Math.min(5, Math.max(1, int(req.body?.rating ?? existing.rating, 5))),
    bool(req.body?.published, Boolean(existing.published)) ? 1 : 0, id
  ];
  if (!values[0] || !values[2]) return sendError(res, 400, 'Name and quote are required.');
  run('UPDATE testimonials SET name=?,role=?,quote=?,rating=?,published=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', values);
  return res.json(one('SELECT * FROM testimonials WHERE id=?', [id]));
});
app.delete('/api/admin/testimonials/:id', auth, (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid testimonial id.');
  run('DELETE FROM testimonials WHERE id=?', [int(req.params.id)]);
  return res.json({ ok: true });
});

app.get('/api/admin/settings', auth, (req, res) => {
  const rows = all('SELECT key,value FROM settings ORDER BY key');
  return res.json(Object.fromEntries(rows.map(row => [row.key, row.value])));
});
app.put('/api/admin/settings', auth, (req, res) => {
  for (const [key, value] of Object.entries(req.body || {})) {
    if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(key)) continue;
    run('INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)', [key, clean(value, 5000)]);
  }
  return res.json({ ok: true });
});

const adminDir = path.join(__dirname, 'public');
app.use(express.static(adminDir, { index: false }));
app.get('/admin', (req, res) => res.sendFile(path.join(adminDir, 'admin', 'index.html')));
app.get('/admin/*splat', (req, res) => res.sendFile(path.join(adminDir, 'admin', 'index.html')));
app.get('/', (req, res) => res.json({ ok: true, service: 'VELNOX Backend', health: '/api/health', admin: '/admin' }));

app.use((req, res) => sendError(res, 404, 'Route not found.'));
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}]`, err);
  if (res.headersSent) return next(err);
  return sendError(res, err.message === 'CORS origin blocked' ? 403 : 500, err.message === 'CORS origin blocked' ? 'CORS origin blocked.' : 'Internal server error.');
});

const server = app.listen(PORT, () => {
  console.log('');
  console.log('==========================================');
  console.log(' VELNOX Backend v2.0.0');
  console.log(` API:   http://localhost:${PORT}/api/health`);
  console.log(` ADMIN: http://localhost:${PORT}/admin/`);
  console.log(` DB:    ${DB_FILE}`);
  console.log('==========================================');
  console.log('');
});

function shutdown(signal) {
  console.log(`\n${signal} received. Saving database...`);
  try { saveDb(); } catch (error) { console.error('Database save failed:', error.message); }
  server.close(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
