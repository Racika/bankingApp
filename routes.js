const express = require('express');
const router = express.Router();
const controller = require('./controller');


router.post('/users', controller.addUser);
router.post('/login', controller.login);
router.get('/user/:email', async (req, res) => {
  const result = await pool.query(queries.getUserByEmail, [req.params.email]);
  const user = result.rows[0];
  res.json({ fullName: user.full_name, email: user.email });
});

module.exports = router;
