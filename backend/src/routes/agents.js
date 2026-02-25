const express = require("express");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/", authRequired, (req, res) => {
  res.json({
    agents: [
      "Intake Agent",
      "Clarifier Agent",
      "Duplicate Detective Agent",
      "Severity + SLA Risk Agent",
      "Routing Agent",
      "Resolution Agent",
      "Customer Comms Agent",
      "Manager Agent"
    ]
  });
});

module.exports = router;
