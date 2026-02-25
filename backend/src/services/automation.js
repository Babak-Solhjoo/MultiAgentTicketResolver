function runAutomation(action, policyAllows) {
  if (!policyAllows) {
    return { ok: false, message: "Policy blocked automation" };
  }

  return {
    ok: true,
    message: `Automation ${action} executed in sandbox.`
  };
}

module.exports = { runAutomation };
