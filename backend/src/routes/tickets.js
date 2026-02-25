const express = require("express");
const { nanoid } = require("nanoid");
const { query, pool } = require("../db");
const { authRequired } = require("../middleware/auth");
const {
  intake,
  clarify,
  managerDebate,
  proposeResolution,
  inferPriority,
  inferAssignees
} = require("../services/orchestrator");
const { applyEscalation } = require("../services/policy");

const router = express.Router();

async function runAutomationForTicket(connection, ticketRow, draftRow, actorLabel) {
  const ticketRowId = ticketRow.id;
  const draft = draftRow || (await intake(ticketRow.body || ticketRow.subject || ""));

  if (!draftRow) {
    await connection.execute(
      "INSERT INTO ticket_drafts (ticket_id, problem, environment, reproduction, impact, user_intent, confidence_json, evidence_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        ticketRowId,
        draft.problem,
        draft.environment,
        draft.reproduction,
        draft.impact,
        draft.userIntent,
        JSON.stringify(draft.confidence || {}),
        JSON.stringify(draft.evidence || {})
      ]
    );
  }

  const debate = await managerDebate({ ticket: { title: ticketRow.subject }, draft });
  const statusAfterDebate = debate.requiresHuman ? "pending_info" : "in_progress";

  await connection.execute(
    "UPDATE tickets SET severity = ?, status = ? WHERE id = ?",
    [debate.severity, statusAfterDebate, ticketRowId]
  );

  await connection.execute(
    "INSERT INTO negotiations (ticket_id, phase, transcript_json) VALUES (?, ?, ?)",
    [ticketRowId, "triage", JSON.stringify(debate.transcript)]
  );

  if (debate.duplicateOf) {
    await connection.execute(
      "INSERT INTO ticket_links (ticket_id, duplicate_of_ticket_id, confidence) VALUES (?, ?, ?)",
      [ticketRowId, debate.duplicateOf, debate.duplicateConfidence]
    );
  }

  const escalation = applyEscalation(debate.slaRisk);
  if (escalation.escalate) {
    await connection.execute(
      "INSERT INTO ticket_updates (ticket_id, author, message) VALUES (?, ?, ?)",
      [ticketRowId, "Policy Engine", escalation.message]
    );
  }

  if (debate.requiresHuman) {
    await connection.execute(
      "INSERT INTO ticket_updates (ticket_id, author, message) VALUES (?, ?, ?)",
      [ticketRowId, actorLabel, "Approval required to continue automation."]
    );
    return { status: "pending_info" };
  }

  const resolution = await proposeResolution({ ticket: { title: ticketRow.subject }, draft });
  await connection.execute(
    "UPDATE tickets SET status = ? WHERE id = ?",
    ["resolved", ticketRowId]
  );
  await connection.execute(
    "INSERT INTO ticket_updates (ticket_id, author, message) VALUES (?, ?, ?)",
    [ticketRowId, "Resolution Agent", resolution]
  );

  return { status: "resolved", resolution };
}

router.get("/", authRequired, async (req, res) => {
  const rows = await query(
    "SELECT id, COALESCE(ticket_id, CONCAT('INC-', id)) AS ticket_id, subject AS title, status, priority, company, assignees_json, severity, created_at FROM tickets ORDER BY created_at DESC"
  );
  res.json({ tickets: rows });
});

router.post("/automate-open", authRequired, async (req, res) => {
  const openTickets = await query(
    "SELECT * FROM tickets WHERE status = ?",
    ["open"]
  );

  if (openTickets.length === 0) {
    return res.json({ processed: 0, skipped: 0 });
  }

  let processed = 0;
  let skipped = 0;

  for (const ticketRow of openTickets) {
    const existingNegotiations = await query(
      "SELECT id FROM negotiations WHERE ticket_id = ? LIMIT 1",
      [ticketRow.id]
    );
    if (existingNegotiations.length > 0) {
      skipped += 1;
      continue;
    }

    const draftRows = await query(
      "SELECT * FROM ticket_drafts WHERE ticket_id = ?",
      [ticketRow.id]
    );

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await runAutomationForTicket(connection, ticketRow, draftRows[0] || null, "Automation Runner");
      await connection.commit();
      processed += 1;
    } catch (err) {
      console.error("[tickets:automate-open] failed", err);
      await connection.rollback();
    } finally {
      connection.release();
    }
  }

  res.json({ processed, skipped });
});

router.get("/by-number/:ticketNumber", authRequired, async (req, res) => {
  const raw = String(req.params.ticketNumber || "").trim();
  if (!raw) {
    return res.status(400).json({ error: "ticketNumber is required" });
  }

  const match = raw.match(/^(INC|TSK)-(\d+)$/i);
  let ticketRows = [];
  if (match) {
    ticketRows = await query("SELECT * FROM tickets WHERE ticket_id = ?", [raw.toUpperCase()]);
    if (ticketRows.length === 0) {
      ticketRows = await query("SELECT * FROM tickets WHERE id = ?", [Number(match[2])]);
    }
  } else {
    ticketRows = await query("SELECT * FROM tickets WHERE ticket_id = ?", [raw]);
  }

  if (ticketRows.length === 0) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const ticket = { ...ticketRows[0], title: ticketRows[0].subject };

  const draftRows = await query("SELECT * FROM ticket_drafts WHERE ticket_id = ?", [ticket.id]);
  const updates = await query(
    "SELECT * FROM ticket_updates WHERE ticket_id = ? ORDER BY created_at DESC",
    [ticket.id]
  );
  const negotiations = await query(
    "SELECT * FROM negotiations WHERE ticket_id = ? ORDER BY created_at DESC",
    [ticket.id]
  );
  const links = await query(
    "SELECT * FROM ticket_links WHERE ticket_id = ? ORDER BY created_at DESC",
    [ticket.id]
  );

  res.json({
    ticket,
    draft: draftRows[0] || null,
    updates,
    negotiations,
    links
  });
});

router.get("/:id", authRequired, async (req, res) => {
  const ticketRows = await query("SELECT * FROM tickets WHERE id = ?", [req.params.id]);
  if (ticketRows.length === 0) {
    return res.status(404).json({ error: "Ticket not found" });
  }
  const ticket = { ...ticketRows[0], title: ticketRows[0].subject };

  const draftRows = await query("SELECT * FROM ticket_drafts WHERE ticket_id = ?", [req.params.id]);
  const updates = await query(
    "SELECT * FROM ticket_updates WHERE ticket_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );
  const negotiations = await query(
    "SELECT * FROM negotiations WHERE ticket_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );
  const links = await query(
    "SELECT * FROM ticket_links WHERE ticket_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );

  res.json({
    ticket,
    draft: draftRows[0] || null,
    updates,
    negotiations,
    links
  });
});

router.post("/", authRequired, async (req, res) => {
  const { rawText, priority, company, assignees, title, type } = req.body;

  if (!rawText) {
    return res.status(400).json({ error: "rawText is required" });
  }

  console.log("[tickets:create] user", req.user);
  console.log("[tickets:create] payload", { priority, company, assignees, rawTextLength: rawText.length });

  const draft = await intake(rawText);
  const resolvedPriority = priority === "Automatic" || !priority
    ? inferPriority(draft)
    : priority;
  const normalizedPriority = String(resolvedPriority).toLowerCase();
  const resolvedAssignees = !assignees || assignees.includes("Automatic")
    ? inferAssignees(draft)
    : assignees;
  const resolvedTitle = title && title.trim().length > 0
    ? title.trim()
    : (draft.problem ? draft.problem.slice(0, 90) : "New incident");
  const prefix = type === "TSK" ? "TSK" : "INC";

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [idRows] = await connection.execute(
      "SELECT MAX(CASE WHEN ticket_id LIKE ? THEN CAST(SUBSTRING_INDEX(ticket_id, '-', -1) AS UNSIGNED) ELSE 0 END) AS max_ticket, MAX(id) AS max_row FROM tickets",
      [`${prefix}-%`]
    );
    const maxTicket = idRows && idRows[0] && idRows[0].max_ticket ? Number(idRows[0].max_ticket) : 0;
    const maxRow = idRows && idRows[0] && idRows[0].max_row ? Number(idRows[0].max_row) : 0;
    const base = prefix === "INC" ? Math.max(maxTicket, maxRow) : maxTicket;
    const nextId = base + 1;
    const ticketNumber = `${prefix}-${nextId}`;

    const ticketResult = await connection.execute(
      "INSERT INTO tickets (ticket_id, source, subject, body, status, priority, severity, created_by, company, assignees_json, assignee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        ticketNumber,
        "web",
        resolvedTitle,
        rawText,
        "open",
        normalizedPriority,
        "low",
        req.user?.email || "unknown",
        company || null,
        resolvedAssignees ? JSON.stringify(resolvedAssignees) : null,
        resolvedAssignees && resolvedAssignees.length > 0 ? resolvedAssignees[0] : null
      ]
    );

    const ticketRowId = ticketResult[0].insertId;

    await connection.execute(
      "INSERT INTO ticket_drafts (ticket_id, problem, environment, reproduction, impact, user_intent, confidence_json, evidence_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        ticketRowId,
        draft.problem,
        draft.environment,
        draft.reproduction,
        draft.impact,
        draft.userIntent,
        JSON.stringify(draft.confidence || {}),
        JSON.stringify(draft.evidence || {})
      ]
    );

    await runAutomationForTicket(
      connection,
      { ...{ id: ticketRowId, subject: resolvedTitle, body: rawText } },
      { ...draft, ticket_id: ticketRowId },
      "Approval Gate"
    );

    await connection.commit();
    res.json({ id: ticketRowId, draft });
  } catch (err) {
    console.error("[tickets:create] failed", err);
    await connection.rollback();
    res.status(500).json({
      error: "Failed to create ticket",
      detail: err && err.message ? err.message : "Unknown error"
    });
  } finally {
    connection.release();
  }
});

router.post("/:id/clarify", authRequired, async (req, res) => {
  const ticketId = req.params.id;
  const draftRows = await query("SELECT * FROM ticket_drafts WHERE ticket_id = ?", [ticketId]);
  if (draftRows.length === 0) {
    return res.status(404).json({ error: "Ticket draft not found" });
  }

  const questions = await clarify(draftRows[0]);
  await query(
    "INSERT INTO ticket_updates (ticket_id, author, message) VALUES (?, ?, ?)",
    [ticketId, "Clarifier Agent", questions.join(" | ")]
  );

  res.json({ questions });
});

router.post("/:id/triage", authRequired, async (req, res) => {
  const ticketId = req.params.id;
  const ticketRows = await query("SELECT * FROM tickets WHERE id = ?", [ticketId]);
  if (ticketRows.length === 0) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const draftRows = await query("SELECT * FROM ticket_drafts WHERE ticket_id = ?", [ticketId]);
  const draft = draftRows[0] || null;

  const debate = await managerDebate({ ticket: ticketRows[0], draft });

  await query(
    "UPDATE tickets SET severity = ?, status = ? WHERE id = ?",
    [debate.severity, debate.status, ticketId]
  );

  await query(
    "INSERT INTO negotiations (ticket_id, phase, transcript_json) VALUES (?, ?, ?)",
    [ticketId, "triage", JSON.stringify(debate.transcript)]
  );

  if (debate.duplicateOf) {
    await query(
      "INSERT INTO ticket_links (ticket_id, duplicate_of_ticket_id, confidence) VALUES (?, ?, ?)",
      [ticketId, debate.duplicateOf, debate.duplicateConfidence]
    );
  }

  const escalation = applyEscalation(debate.slaRisk);
  if (escalation.escalate) {
    await query(
      "INSERT INTO ticket_updates (ticket_id, author, message) VALUES (?, ?, ?)",
      [ticketId, "Policy Engine", escalation.message]
    );
  }

  res.json({ debate, escalation });
});

router.post("/:id/resolve", authRequired, async (req, res) => {
  const ticketId = req.params.id;
  const ticketRows = await query("SELECT * FROM tickets WHERE id = ?", [ticketId]);
  if (ticketRows.length === 0) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const draftRows = await query("SELECT * FROM ticket_drafts WHERE ticket_id = ?", [ticketId]);
  const resolution = await proposeResolution({ ticket: ticketRows[0], draft: draftRows[0] || null });

  await query("UPDATE tickets SET status = ? WHERE id = ?", ["resolved", ticketId]);
  await query(
    "INSERT INTO ticket_updates (ticket_id, author, message) VALUES (?, ?, ?)",
    [ticketId, "Resolution Agent", resolution]
  );

  res.json({ resolution });
});

router.post("/:id/approve", authRequired, async (req, res) => {
  const ticketId = req.params.id;
  const ticketRows = await query("SELECT * FROM tickets WHERE id = ?", [ticketId]);
  if (ticketRows.length === 0) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const draftRows = await query("SELECT * FROM ticket_drafts WHERE ticket_id = ?", [ticketId]);
  const ticket = { ...ticketRows[0], title: ticketRows[0].subject };
  const draft = draftRows[0] || null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "UPDATE tickets SET status = ? WHERE id = ?",
      ["in_progress", ticketId]
    );
    await connection.execute(
      "INSERT INTO ticket_updates (ticket_id, author, message) VALUES (?, ?, ?)",
      [ticketId, "Approval Gate", `Approved by ${req.user?.email || "user"}. Resuming automation.`]
    );

    const resolution = await proposeResolution({ ticket, draft });
    await connection.execute(
      "UPDATE tickets SET status = ? WHERE id = ?",
      ["resolved", ticketId]
    );
    await connection.execute(
      "INSERT INTO ticket_updates (ticket_id, author, message) VALUES (?, ?, ?)",
      [ticketId, "Resolution Agent", resolution]
    );

    await connection.commit();
    res.json({ ok: true, resolution });
  } catch (err) {
    console.error("[tickets:approve] failed", err);
    await connection.rollback();
    res.status(500).json({
      error: "Failed to approve ticket",
      detail: err && err.message ? err.message : "Unknown error"
    });
  } finally {
    connection.release();
  }
});

router.patch("/:id", authRequired, async (req, res) => {
  const ticketId = req.params.id;
  const { title, status, priority, company, assignees } = req.body;

  const existingRows = await query("SELECT * FROM tickets WHERE id = ?", [ticketId]);
  if (existingRows.length === 0) {
    return res.status(404).json({ error: "Ticket not found" });
  }
  const existingTicket = existingRows[0];

  const fields = [];
  const values = [];

  if (title) {
    fields.push("subject = ?");
    values.push(title);
  }
  if (status) {
    fields.push("status = ?");
    values.push(status);
  }
  if (priority) {
    fields.push("priority = ?");
    values.push(String(priority).toLowerCase());
  }
  if (company !== undefined) {
    fields.push("company = ?");
    values.push(company);
  }
  if (assignees !== undefined) {
    fields.push("assignees_json = ?");
    const resolved = assignees && assignees.includes("Automatic")
      ? inferAssignees(title || existingTicket.title)
      : assignees;
    values.push(resolved ? JSON.stringify(resolved) : null);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  values.push(ticketId);
  await query(`UPDATE tickets SET ${fields.join(", ")} WHERE id = ?`, values);

  const rows = await query("SELECT * FROM tickets WHERE id = ?", [ticketId]);
  res.json({ ticket: { ...rows[0], title: rows[0].subject } });
});

module.exports = router;
