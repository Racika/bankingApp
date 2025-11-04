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
      a.funds
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
`



};
