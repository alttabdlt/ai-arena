#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function asPct(value) {
  if (!Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function listToInline(items) {
  if (!Array.isArray(items) || items.length === 0) return 'none';
  return items.join(', ');
}

function print(line = '') {
  process.stdout.write(`${line}\n`);
}

async function main() {
  const reportPathArg = process.argv[2];
  if (!reportPathArg) {
    throw new Error('Usage: node scripts/autonomy-report-summary.mjs <report-path> [label]');
  }
  const reportPath = path.resolve(reportPathArg);
  const label = process.argv[3] || path.basename(path.dirname(reportPath)) || 'autonomy';
  const raw = await fs.readFile(reportPath, 'utf8');
  const report = JSON.parse(raw);

  print(`## ${label} Summary`);
  print(`- \`ok\`: ${report.ok === true ? 'true' : 'false'}`);
  if (Number.isFinite(report.durationMs)) print(`- \`durationMs\`: ${report.durationMs}`);
  if (Number.isFinite(report.totalTicks)) print(`- \`totalTicks\`: ${report.totalTicks}`);
  if (Number.isFinite(report.agentCount)) print(`- \`agentCount\`: ${report.agentCount}`);
  if (report.townId) print(`- \`townId\`: ${report.townId}`);
  if (report.soakTownId) print(`- \`soakTownId\`: ${report.soakTownId}`);

  if (report.autonomy?.familiesObserved) {
    print(`- \`familiesObserved\`: ${listToInline(report.autonomy.familiesObserved)}`);
  }
  if (report.coreFamiliesObserved) {
    print(`- \`coreFamiliesObserved\`: ${listToInline(report.coreFamiliesObserved)}`);
  }
  if (report.missingCoreFamilies) {
    print(`- \`missingCoreFamilies\`: ${listToInline(report.missingCoreFamilies)}`);
  }

  if (Array.isArray(report.reasoningCoverage) && report.reasoningCoverage.length > 0) {
    const avgCoverage = report.reasoningCoverage.reduce((sum, row) => sum + Number(row.reasoningCoverage || 0), 0) / report.reasoningCoverage.length;
    print(`- \`avgReasoningCoverage\`: ${asPct(avgCoverage)}`);
  }
  if (report.economy?.latest) {
    const latest = report.economy.latest;
    print(`- \`ledgerTotal\`: ${Number.isFinite(latest.ledgerTotal) ? latest.ledgerTotal : 'n/a'}`);
    const byType = latest.ledgerByType && typeof latest.ledgerByType === 'object' ? latest.ledgerByType : {};
    const critical = Array.isArray(report.criticalLedgerTypes) ? report.criticalLedgerTypes : [];
    if (critical.length > 0) {
      const present = critical.filter((type) => Number(byType[type] || 0) > 0);
      print(`- \`criticalLedgerTypesPresent\`: ${listToInline(present)}`);
    }
    print(`- \`poolBudgets\`: ops=${latest.opsBudget}, pvp=${latest.pvpBudget}, rescue=${latest.rescueBudget}, insurance=${latest.insuranceBudget}`);
    print(`- \`poolLiquidity\`: reserve=${latest.reserveBalance}, arena=${latest.arenaBalance}`);
  }
  if (report.economy?.audit) {
    const audit = report.economy.audit;
    const latestAudit = audit.latest && typeof audit.latest === 'object' ? audit.latest : null;
    print(`- \`economyAuditOkRatio\`: ${asPct(Number(audit.okRatio || 0))}`);
    if (latestAudit) {
      print(`- \`economyAuditLatestOk\`: ${latestAudit.ok === true ? 'true' : 'false'}`);
      print(`- \`economyAuditDrift\`: ${Number.isFinite(latestAudit.driftSinceBaseline) ? latestAudit.driftSinceBaseline : 'n/a'}`);
      if (Array.isArray(latestAudit.failedChecks) && latestAudit.failedChecks.length > 0) {
        print(`- \`economyAuditFailedChecks\`: ${listToInline(latestAudit.failedChecks)}`);
      }
    }
  }

  if (Number.isFinite(report.failureCount)) {
    print(`- \`failureCount\`: ${report.failureCount}`);
  }
  if (Array.isArray(report.failures) && report.failures.length > 0) {
    print('');
    print('### Top Failures');
    for (const failure of report.failures.slice(0, 8)) {
      const line = `- ${failure.type || 'FAILURE'}${failure.agentId ? ` [${failure.agentId}]` : ''}: ${failure.message || ''}`;
      print(line);
    }
  }
}

main().catch((error) => {
  console.error(`[autonomy-report-summary] ${String(error?.message || error)}`);
  process.exit(1);
});
