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
    funds: user.funds,
    savings: user.savings
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
    funds: user.funds,
    savings: user.savings
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
// TRANSFER MONEY
async function transferMoney(req, res) {
  try {
    const { fromCard, toCard, amount } = req.body;

    if (!fromCard || !toCard || !amount || amount <= 0)
      return res.status(400).json({ error: "Invalid parameters" });

    if (fromCard === toCard)
      return res.status(400).json({ error: "Cannot send money to the same card" });

    // Fetch recipient
    const recipientQuery = await pool.query(
      `SELECT a.id, u.full_name 
       FROM accounts a 
       JOIN users u ON u.id = a.id
       WHERE a.cardnum = $1`,
      [toCard]
    );

    if (recipientQuery.rows.length === 0)
      return res.json({ success: false, message: "Recipient card not found" });

    const recipientId = recipientQuery.rows[0].id;
    const recipientName = recipientQuery.rows[0].full_name;

    // Fetch sender
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
        funds: senderFunds,
      });

    // Deduct from sender
    await pool.query("UPDATE accounts SET funds = funds - $2 WHERE cardnum = $1", [
      fromCard,
      amount,
    ]);

    const now = new Date();

    // Record spending
    await pool.query(queries.addSpendingRecord, [
      senderId,
      now.getFullYear(),
      now.toLocaleString("default", { month: "long" }),
      now.getDate(),
      amount,
      "transfer",
    ]);

    // Add to recipient
    const result = await pool.query(
      "UPDATE accounts SET funds = funds + $2 WHERE cardnum = $1 RETURNING funds",
      [toCard, amount]
    );

    const newRecipientFunds = result.rows[0].funds;

    // Record earning
    await pool.query(queries.addEarningRecord, [
      recipientId,
      now.getFullYear(),
      now.toLocaleString("default", { month: "long" }),
      now.getDate(),
      amount,
      senderName,
    ]);

    // Add to recent requests (recent transfer target)
    await pool.query(queries.insertRecentRequest, [
      senderId,
      toCard,
      recipientName,
    ]);

    return res.json({
      success: true,
      message: "Transfer successful",
      sender: senderName,
      recipientFunds: newRecipientFunds,
    });
  } catch (err) {
    console.error("transferMoney error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}


async function spendMoney(req, res) {
  const { userId, amount, category } = req.body;
  const client = await pool.connect();

  try {
    // Get savings settings
    const settingsRes = await client.query(queries.getSavingsSettings, [userId]);
    const settings = settingsRes.rows[0];

    let roundUp = 0;

    if (settings && settings.round_up_enabled) {
      if (amount < settings.small_purchase_trigger) {
        roundUp = settings.small_purchase_amount;
      } else {
        roundUp = settings.big_purchase_amount;
      }
    }

    const totalDebit = Number(amount) + Number(roundUp);

    // Check balance
    const fundsRes = await client.query(
      `SELECT funds FROM accounts WHERE id = $1`,
      [userId]
    );
    const currentFunds = Number(fundsRes.rows[0].funds);

    if (currentFunds < totalDebit) {
      return res.status(400).json({
        error: "Insufficient funds including round-up."
      });
    }

    // Deduct main spend
    await client.query(
      `UPDATE accounts SET funds = funds - $1 WHERE id = $2`,
      [amount, userId]
    );

    // Insert spending record
    const date = new Date();
    await client.query(queries.addSpendingRecord, [
      userId,
      date.getFullYear(),
      date.toLocaleString("en-US", { month: "long" }),
      date.getDate(),
      amount,
      category
    ]);

    // Handle round-up savings
    if (roundUp > 0) {
      await client.query(queries.updateSavings, [userId, roundUp]);
      await client.query(queries.insertSavingsTx, [userId, roundUp, category]);
    }

    res.json({
      success: true,
      spent: amount,
      roundedToSavings: roundUp,
    });

  } catch (err) {
    console.error("SpendMoney error:", err);
    res.status(500).json({ error: "Spend failed" });
  } finally {
    client.release();
  }
}


async function getSpendings(req, res) {
  try {
    const { userId, month } = req.body;

    if (!userId || !month) {
      return res.status(400).json({ error: "Missing userId or month" });
    }

    const result = await pool.query(
      queries.getSpendingsByMonth,
      [userId, month]
    );

    return res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

async function getEarnings(req, res) {
  try {
    const { userId, month } = req.body;
    if (!userId || !month) return res.status(400).json({ error: "Missing fields" });

    const result = await pool.query(
      queries.getEarningsByMonth,
      [userId, month]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
// CREATE REQUEST (for money requests)
async function createRequest(req, res) {
  try {
    const { recipientCard, requesterCard, requesterName, amount } = req.body;

    if (!recipientCard || !requesterCard || !requesterName || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get requester ID (the sender)
    const requesterQuery = await pool.query(
      "SELECT id FROM accounts WHERE cardnum = $1",
      [requesterCard]
    );

    if (requesterQuery.rows.length === 0)
      return res.status(404).json({ error: "Requester not found" });

    const requesterId = requesterQuery.rows[0].id;

    // Get recipient info (so we can store their name & card)
    const recipientQuery = await pool.query(
      "SELECT u.full_name FROM users u JOIN accounts a ON u.id = a.id WHERE a.cardnum = $1",
      [recipientCard]
    );

    if (recipientQuery.rows.length === 0)
      return res.status(404).json({ error: "Recipient not found" });

    const recipientName = recipientQuery.rows[0].full_name;

    // Create the money request
    const result = await pool.query(queries.createRequest, [
      recipientCard,
      requesterCard,
      requesterName,
      amount,
    ]);

    // Add to recent requests
    await pool.query(queries.insertRecentRequest, [
      requesterId,
      recipientCard,
      recipientName,
    ]);

    return res.json({
      message: "Request created successfully",
      request: result.rows[0],
    });
  } catch (err) {
    console.error("createRequest error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

async function getRequestsForUser(req, res) {
  try {
    const { cardnum } = req.body;

    if (!cardnum) {
      return res.status(400).json({ error: "Card number required" });
    }

    const result = await pool.query(
      queries.getRequestsForUser,
      [cardnum]
    );

    return res.json(result.rows);

  } catch (err) {
    console.error("Error fetching requests:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
async function deleteRequest(req, res) {
  try {
    const { request_id } = req.body;

    if (!request_id) {
      return res.status(400).json({ error: "Request ID required" });
    }

    const result = await pool.query(queries.deleteRequest, [request_id]);

    return res.json({ success: true, message: "Request deleted" });

  } catch (err) {
    console.error("Error deleting request:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
async function updateSavingsSettings(req, res) {
  const { userId, round_up_enabled, goal } = req.body;

  try {
    await pool.query(queries.updateSavingsSettings, [
      userId,
      round_up_enabled,
      goal
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("UpdateSavingsSettings error:", err);
    res.status(500).json({ error: "Settings update failed" });
  }
}
async function getSavingsSettings(req, res) {
  const { userId } = req.body;

  try {
    const result = await pool.query(queries.getSavingsSettings, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Savings settings not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("getSavingsSettings error:", err);
    return res.status(500).json({ error: "Failed to retrieve savings settings" });
  }
}
async function getSavingsTransactions(req, res) {
  const { userId } = req.body;

  try {
    const result = await pool.query(queries.getSavingsTransactions, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error("getSavingsTransactions error:", err);
    return res.status(500).json({ error: "Failed to retrieve savings transactions" });
  }
}

const addRecentRequest = async (userId, requestedNumber, requestedName) => {
  try {
    await pool.query(queries.insertRecentRequest, [
      userId,
      requestedNumber,
      requestedName,
    ]);
  } catch (err) {
    console.error("Error inserting recent request:", err);
  }
};


const getRecentRequests = async (req, res) => {
  try {
    const { userId } = req.body;
    const result = await pool.query(queries.getRecentRequests, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching recent requests:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};






module.exports = {
  addUser,login,getUserWithAccount,getMe,withdrawFunds,addFunds,transferMoney,spendMoney,getSpendings,getEarnings,createRequest,getRequestsForUser,
  deleteRequest,updateSavingsSettings,getSavingsSettings,getSavingsTransactions,addRecentRequest,getRecentRequests
};
