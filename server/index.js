require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./database');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const buildDir = path.join(__dirname, '..', 'client', 'build');
const publicDir = path.join(__dirname, '..', 'client', 'public');
const clientDir = fs.existsSync(buildDir) ? buildDir : publicDir;

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors(
  allowedOrigins.length > 0
    ? { origin: allowedOrigins }
    : undefined
));
app.use(express.json());

// Serve static frontend files
app.use(express.static(clientDir));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api', requireAuth);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), user: req.user.email });
});
app.use('/api/members', require('./routes/members'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/settings', require('./routes/settings'));

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Wait for database to be ready, then start server
db.ready().then(() => {
  app.listen(PORT, () => {
    console.log(`3MA-CRM server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
