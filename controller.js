const { pool } = require('./db');
const queries = require('./queries');

async function addUser(req, res) {
  try {
    const { email, fullName } = req.body;
    if (!email || !fullName) {
      return res.status(400).json({ error: 'email and fullName are required' });
    }

    const result = await pool.query(queries.addUser, [email, fullName]);
    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('addUser error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  addUser,
};
