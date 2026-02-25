require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { testConnection } = require("./db");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const agentRoutes = require("./routes/agents");
const negotiationRoutes = require("./routes/negotiations");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", async (req, res) => {
  const dbOk = await testConnection();
  res.json({ status: "ok", db: dbOk });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/negotiations", negotiationRoutes);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
