module.exports = {
    addUser: `
      INSERT INTO users (email, full_name)
      VALUES ($1, $2)
      RETURNING id, email, full_name, created_at;
    `,
  };
  