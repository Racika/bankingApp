const express = require('express');
const router = express.Router();
const controller = require('./controller');
const verifyToken = require("./middleware/auth");
router.get("/me", verifyToken, controller.getMe);


router.post('/users', controller.addUser);
router.post('/login', controller.login);
router.get('/user/:email', controller.getUserWithAccount);
router.post('/addFunds', verifyToken, controller.addFunds);
router.post('/withdrawFunds', verifyToken, controller.withdrawFunds);
router.post('/transferMoney', verifyToken, controller.transferMoney);
router.post('/spendMoney', verifyToken, controller.spendMoney);
router.post("/spendings", verifyToken, controller.getSpendings);
router.post("/earnings", verifyToken, controller.getEarnings);
router.post("/requestPayment", verifyToken, controller.createRequest);
router.post("/getRequests", verifyToken, controller.getRequestsForUser);
router.post("/deleteRequest", verifyToken, controller.deleteRequest);

module.exports = router;
