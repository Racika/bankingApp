const { pool } = require('./db');
const queries = require('./queries');
const bcrypt = require("bcrypt");


async function addUser(req, res) {
  try {
    const { email, fullName, password } = req.body;
    if (!email || !fullName || !password)
      return res.status(400).json({ error: "Missing fields" });

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(queries.addUser, [email, fullName, hash]);

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: "Email already exists" });

    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
async function login(req, res) {
  const { email, password } = req.body;

  const result = await pool.query(queries.getUserByEmail, [email]);
  const user = result.rows[0];

  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  res.json({
    id: user.id,
    fullName: user.full_name,
    email: user.email
  });
}

module.exports = {
  addUser,login
};
