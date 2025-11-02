require('dotenv').config();
const express = require('express');
const routes = require('./routes');

const app = express();
app.use(express.json());


app.get('/health', (_, res) => res.json({ ok: true }));


app.use('/api', routes);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
