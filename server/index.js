require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./database');
const { requireAuth } = require('./middleware/auth');
const googleRoutes = require('./routes/google');
const { configurationMessage } = require('./google/client');

const app = express();
const PORT = process.env.PORT || 3000;
const clientDir = path.join(__dirname, '..', 'client', 'build');
const googleConfigMessage = configurationMessage();

if (googleConfigMessage) {
  console.warn(`Google integration disabled: ${googleConfigMessage}`);
}

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors(
  allowedOrigins.length > 0
    ? { origin: allowedOrigins }
    : undefined
));
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files
app.use(express.static(clientDir));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.get('/api/google/oauth/callback', googleRoutes.oauthCallback);
app.use('/api', requireAuth);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), user: req.user.email });
});
app.use('/api/google', googleRoutes.router);
app.use('/api/members', require('./routes/members'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/legislators', require('./routes/legislators'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/search', require('./routes/search'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/attachments', require('./routes/attachments'));
app.use('/api/goals', require('./routes/goals'));

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
