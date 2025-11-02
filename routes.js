const express = require('express');
const router = express.Router();
const controller = require('./controller');

// Example: POST /api/users -> add user
router.post('/users', controller.addUser);

module.exports = router;
