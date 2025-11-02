module.exports = {
  addUser: `
    INSERT INTO users (email, full_name, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id, email, full_name, created_at;
  `,

  getUserByEmail: `
    SELECT * FROM users WHERE email = $1;
  `
};
