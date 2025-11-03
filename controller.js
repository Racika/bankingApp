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


const jwt = require("jsonwebtoken");

async function login(req, res) {
  const { email, password } = req.body;

  const result = await pool.query(queries.getUserByEmail, [email]);
  const user = result.rows[0];

  if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES }
  );

  res.json({
    token,
    fullName: user.full_name,
    email: user.email,
    cardnum: user.cardnum,
    funds: user.funds
  });
}

async function getMe(req, res) {
  const result = await pool.query(queries.getUserByEmail, [req.user.email]);
  const user = result.rows[0];

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    cardnum: user.cardnum,
    funds: user.funds
  });
}




async function getUserWithAccount(req, res) {
  const { email } = req.params;
  const result = await pool.query(queries.getUserByEmail, [email]);

  if (result.rows.length === 0)
    return res.status(404).json({ error: "User not found" });

  const user = result.rows[0];

  res.json({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    cardnum: user.cardnum,
    funds: user.funds
  });
}

async function withdrawFunds(req, res) {
  try {
    const { cardnum, amount } = req.body;

    if (!cardnum || !amount || amount <= 0)
      return res.status(400).json({ error: "Invalid parameters" });

    
    const cardCheck = await pool.query(
      "SELECT funds FROM accounts WHERE cardnum = $1",
      [cardnum]
    );

    if (cardCheck.rows.length === 0)
      return res.json({ success: false, message: "Card not found" });

    const currentFunds = parseFloat(cardCheck.rows[0].funds);

    
    if (currentFunds < amount)
      return res.json({
        success: false,
        message: "Insufficient funds",
        funds: currentFunds
      });

    
    const result = await pool.query(
      "UPDATE accounts SET funds = funds - $2 WHERE cardnum = $1 RETURNING funds",
      [cardnum, amount]
    );

    return res.json({
      success: true,
      funds: result.rows[0].funds
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}

async function addFunds(req, res) {
  try {
    const { cardnum, amount } = req.body;

    if (!cardnum || !amount || amount <= 0)
      return res.status(400).json({ error: "Invalid parameters" });

    const cardCheck = await pool.query(
      "SELECT funds FROM accounts WHERE cardnum = $1",
      [cardnum]
    );

    if (cardCheck.rows.length === 0)
      return res.json({ success: false, message: "Card not found" });

    const result = await pool.query(
      "UPDATE accounts SET funds = funds + $2 WHERE cardnum = $1 RETURNING funds",
      [cardnum, amount]
    );

    return res.json({
      success: true,
      funds: result.rows[0].funds
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
async function transferMoney(req, res) {
  try {
    const { fromCard, toCard, amount } = req.body;

    if (!fromCard || !toCard || !amount || amount <= 0)
      return res.status(400).json({ error: "Invalid parameters" });

    if (fromCard === toCard)
      return res.status(400).json({ error: "Cannot send money to the same card" });

    D
    const recipientQuery = await pool.query(
      "SELECT id FROM accounts WHERE cardnum = $1",
      [toCard]
    );
    if (recipientQuery.rows.length === 0)
      return res.json({ success: false, message: "Recipient card not found" });

    const recipientId = recipientQuery.rows[0].id;

    
    const senderQuery = await pool.query(
      `SELECT a.id, a.funds, u.full_name
       FROM accounts a 
       JOIN users u ON u.id = a.id
       WHERE a.cardnum = $1`,
      [fromCard]
    );

    if (senderQuery.rows.length === 0)
      return res.json({ success: false, message: "Sender card not found" });

    const senderId = senderQuery.rows[0].id;
    const senderFunds = parseFloat(senderQuery.rows[0].funds);
    const senderName = senderQuery.rows[0].full_name; 

    if (senderFunds < amount)
      return res.json({
        success: false,
        message: "Insufficient funds",
        funds: senderFunds
      });

  
    await pool.query(
      "UPDATE accounts SET funds = funds - $2 WHERE cardnum = $1",
      [fromCard, amount]
    );

    
    const now = new Date();
    await pool.query(
      queries.addSpendingRecord,
      [
        senderId,
        now.getFullYear(),
        now.toLocaleString("default", { month: "long" }),
        now.getDate(),
        amount,
        "transfer"
      ]
    );

    
    const result = await pool.query(
      "UPDATE accounts SET funds = funds + $2 WHERE cardnum = $1 RETURNING funds",
      [toCard, amount]
    );

    const newRecipientFunds = result.rows[0].funds;

    
    await pool.query(
      queries.addEarningRecord,
      [
        recipientId,
        now.getFullYear(),
        now.toLocaleString("default", { month: "long" }),
        now.getDate(),
        amount,
        senderName 
      ]
    );

    return res.json({
      success: true,
      message: "Transfer successful",
      sender: senderName,
      recipientFunds: newRecipientFunds
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}

async function spendMoney(req, res) {
  try {
    const { cardnum, amount, category } = req.body;

    if (!cardnum || !amount || amount <= 0 || !category)
      return res.status(400).json({ error: "Invalid parameters" });

    
    const cardCheck = await pool.query(
      `SELECT a.id, a.funds, u.full_name
       FROM accounts a 
       JOIN users u ON u.id = a.id
       WHERE a.cardnum = $1`,
      [cardnum]
    );

    if (cardCheck.rows.length === 0)
      return res.json({ success: false, message: "Card not found" });

    const userId = cardCheck.rows[0].id;
    const currentFunds = parseFloat(cardCheck.rows[0].funds);

    
    if (currentFunds < amount)
      return res.json({
        success: false,
        message: "Insufficient funds",
        funds: currentFunds
      });

    
    const update = await pool.query(
      "UPDATE accounts SET funds = funds - $2 WHERE cardnum = $1 RETURNING funds",
      [cardnum, amount]
    );

    const newFunds = update.rows[0].funds;

    
    const now = new Date();
    await pool.query(queries.addSpendingRecord, [
      userId,
      now.getFullYear(),
      now.toLocaleString("default", { month: "long" }),
      now.getDate(),
      amount,
      category
    ]);

    return res.json({
      success: true,
      message: "Purchase logged",
      funds: newFunds
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  addUser,login,getUserWithAccount,getMe,withdrawFunds,addFunds,transferMoney,spendMoney
};
