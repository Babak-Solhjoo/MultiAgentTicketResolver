const express = require("express");
const { query } = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/:ticketId", authRequired, async (req, res) => {
  const rows = await query(
    "SELECT * FROM negotiations WHERE ticket_id = ? ORDER BY created_at DESC",
    [req.params.ticketId]
  );
  res.json({ negotiations: rows });
});

module.exports = router;
