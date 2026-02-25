function applyEscalation(slaRisk) {
  if (slaRisk > 0.7) {
    return {
      escalate: true,
      message: "SLA risk above threshold. Auto-page on-call and raise comms urgency."
    };
  }

  return { escalate: false, message: "No escalation required." };
}

module.exports = { applyEscalation };
