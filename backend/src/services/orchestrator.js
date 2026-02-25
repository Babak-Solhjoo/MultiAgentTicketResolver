const { nanoid } = require("nanoid");
const { buildLlm } = require("./llm");

const llm = buildLlm();

function inferEnvironment(rawText) {
  const lower = rawText.toLowerCase();
  if (lower.includes("windows")) return "Windows";
  if (lower.includes("mac")) return "macOS";
  if (lower.includes("linux")) return "Linux";
  if (lower.includes("chrome")) return "Chrome";
  if (lower.includes("firefox")) return "Firefox";
  return "Unknown";
}

function extractImpact(rawText) {
  const lower = rawText.toLowerCase();
  if (lower.includes("payment") || lower.includes("billing")) return "Revenue impact";
  if (lower.includes("login") || lower.includes("auth")) return "Access blocked";
  if (lower.includes("down") || lower.includes("outage")) return "Service unavailable";
  return "Degraded experience";
}

async function intake(rawText) {
  const draft = {
    problem: rawText.slice(0, 140),
    environment: inferEnvironment(rawText),
    reproduction: "User reported issue, steps pending.",
    impact: extractImpact(rawText),
    userIntent: "Resolve and confirm service health.",
    confidence: {
      environment: 0.42,
      impact: 0.5
    },
    evidence: {
      environment: "Keyword scan",
      impact: "Keyword scan"
    }
  };

  if (!llm) {
    return draft;
  }

  const prompt =
    "Extract a structured ticket draft with fields: problem, environment, reproduction, impact, userIntent, confidence, evidence. Output JSON only. Raw input: " +
    rawText;

  try {
    const response = await llm.invoke(prompt);
    const parsed = JSON.parse(response.content);
    return { ...draft, ...parsed };
  } catch (err) {
    return draft;
  }
}

async function clarify(draft) {
  const questions = [];
  if (!draft.environment || draft.environment === "Unknown") {
    questions.push("Which OS and app version are you using?");
  }
  if (!draft.reproduction || draft.reproduction.includes("pending")) {
    questions.push("Can you share the exact steps to reproduce?");
  }
  if (!draft.impact) {
    questions.push("How many users or teams are impacted?");
  }

  if (questions.length === 0) {
    questions.push("Any recent changes before the issue started?");
  }

  return questions.slice(0, 3);
}

function detectDuplicate(rawText) {
  if (rawText.toLowerCase().includes("login")) {
    return { match: 8142, confidence: 0.86 };
  }
  return { match: null, confidence: 0.0 };
}

function assessSeverity(rawText, impact) {
  const lower = rawText.toLowerCase();
  if (lower.includes("outage") || impact === "Service unavailable") {
    return { severity: "S1", slaRisk: 0.85 };
  }
  if (lower.includes("payment") || lower.includes("billing")) {
    return { severity: "S2", slaRisk: 0.65 };
  }
  return { severity: "S3", slaRisk: 0.3 };
}

function inferPriority(draft) {
  const impact = draft?.impact || "";
  const { severity } = assessSeverity(draft?.problem || "", impact);
  if (severity === "S1") return "Critical";
  if (severity === "S2") return "High";
  if (severity === "S3") return "Medium";
  return "Low";
}

function routeTicket(rawText) {
  const lower = rawText.toLowerCase();
  if (lower.includes("billing") || lower.includes("payment")) return "billing";
  if (lower.includes("auth") || lower.includes("login")) return "auth";
  if (lower.includes("infra") || lower.includes("outage")) return "infra";
  if (lower.includes("ui") || lower.includes("frontend")) return "frontend";
  return "backend";
}

function inferAssignees(draftOrText) {
  const text = typeof draftOrText === "string" ? draftOrText : draftOrText?.problem || "";
  const team = routeTicket(text);
  const label = `${team.charAt(0).toUpperCase()}${team.slice(1)} Team`;
  return [label];
}

async function proposeResolution({ ticket, draft }) {
  const core = draft?.problem || ticket.title;
  return (
    "Workaround now: capture logs and confirm the affected endpoints. " +
    "Escalation next: assign to on-call if metrics stay degraded. " +
    "Summary: " +
    core
  );
}

async function managerDebate({ ticket, draft }) {
  const transcript = [];
  const baseText = draft?.problem || ticket.title;
  const duplicate = detectDuplicate(baseText);
  const impact = draft?.impact || "Unknown impact";
  const severity = assessSeverity(baseText, impact);
  const team = routeTicket(baseText);

  transcript.push({
    id: nanoid(),
    agent: "Duplicate Detective Agent",
    message: duplicate.match
      ? `Potential duplicate of #${duplicate.match} (${duplicate.confidence})`
      : "No strong duplicate signal",
    evidence: duplicate.match ? "Keyword overlap" : "None"
  });

  transcript.push({
    id: nanoid(),
    agent: "Severity + SLA Risk Agent",
    message: `Severity ${severity.severity} with SLA risk ${severity.slaRisk}`,
    evidence: impact
  });

  transcript.push({
    id: nanoid(),
    agent: "Routing Agent",
    message: `Route to ${team} team. Automation lane: no`
  });

  transcript.push({
    id: nanoid(),
    agent: "Manager Agent",
    message: "Consensus reached with evidence from draft keywords."
  });

  return {
    severity: severity.severity,
    slaRisk: severity.slaRisk,
    team,
    status: "triaged",
    requiresHuman: true,
    duplicateOf: duplicate.match,
    duplicateConfidence: duplicate.confidence,
    transcript
  };
}

module.exports = {
  intake,
  clarify,
  managerDebate,
  proposeResolution,
  inferPriority,
  inferAssignees
};
