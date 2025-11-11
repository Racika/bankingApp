module.exports = {
  addUser: `
    INSERT INTO users (email, full_name, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id, email, full_name, created_at;
  `,

  getUserByEmail: `
    SELECT 
      u.id,
      u.email,
      u.full_name,
      u.password_hash,
      a.cardnum,
      a.funds,
      a.savings
    FROM users u
    JOIN accounts a ON u.id = a.id
    WHERE u.email = $1;
  `,
  addFunds: `
    UPDATE accounts
    SET funds = funds + $2
    WHERE id = $1
    RETURNING funds;
  `,

  withdrawFunds: `
    UPDATE accounts
    SET funds = funds - $2
    WHERE id = $1
    RETURNING funds;
  `,
  addEarningRecord: `
  INSERT INTO earnings (id, year, month, day, amount, sender)
  VALUES ($1, $2, $3, $4, $5, $6);
`,
addSpendingRecord: `
  INSERT INTO spendings (id, year, month, day, amount, category)
  VALUES ($1, $2, $3, $4, $5, $6);
`,
getSpendingsByMonth: `
  SELECT day, amount, category
  FROM spendings
  WHERE id = $1 
  AND LOWER(TRIM(month)) = LOWER(TRIM($2))
  ORDER BY day ASC;
`,
getEarningsByMonth: `
  SELECT day, amount, sender 
  FROM earnings
  WHERE id = $1 AND month = $2
  ORDER BY day ASC;
`,
createRequest: `
  INSERT INTO requests (recipient_cardnum, requester_cardnum, requester_name, amount)
  VALUES ($1, $2, $3, $4)
  RETURNING request_id, recipient_cardnum, requester_cardnum, requester_name, amount, created_at;
`,
getRequestsForUser: `
  SELECT request_id, requester_cardnum, requester_name, amount, created_at
  FROM requests
  WHERE recipient_cardnum = $1
  ORDER BY created_at DESC;
`,
deleteRequest: `
  DELETE FROM requests
  WHERE request_id = $1;
`,
updateSavings: `
  UPDATE accounts
  SET savings = savings + $2, funds = funds - $2
  WHERE id = $1
  RETURNING savings, funds;
`,

getSavingsSettings: `
  SELECT round_up_enabled, small_purchase_trigger, small_purchase_amount, big_purchase_amount, goal
  FROM savings_settings
  WHERE user_id = $1;
`,

updateSavingsSettings: `
  UPDATE savings_settings
  SET round_up_enabled = $2,
      goal = $3,
      updated_at = NOW()
  WHERE user_id = $1;
`,

insertSavingsTx: `
  INSERT INTO savings_transactions (user_id, amount, category)
  VALUES ($1, $2, $3);
`,
getSavingsSettings: `
  SELECT *
  FROM savings_settings
  WHERE user_id = $1
`,

getSavingsTransactions: `
  SELECT amount, category, created_at
  FROM savings_transactions
  WHERE user_id = $1
  ORDER BY created_at DESC
`,
insertRecentRequest: `
  INSERT INTO recent_requests (id, requested_number, requested_name)
  VALUES ($1, $2, $3)
  ON CONFLICT (id, requested_number) DO UPDATE
  SET requested_name = EXCLUDED.requested_name, created_at = NOW();
`,

getRecentRequests: `
  SELECT requested_number, requested_name, created_at
  FROM recent_requests
  WHERE id = $1
  ORDER BY created_at DESC;
`,


};
