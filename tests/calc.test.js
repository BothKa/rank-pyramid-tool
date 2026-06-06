const assert = require("node:assert/strict");
const core = require("../app.js");

const { analyze, calcCascade, countProgressForUnits, countProgressForWan, cycleStatusFor, cycleStatusForTeamCoverage, effectiveUnitAllocation, CYCLES, gateFor, GATES, PHASES, PRIMARY_GATES, leaderTotalWanFromUnitCounts, maxWanOf, phaseStatusFor, phaseStatusForUnitCounts, teamTierFor, toWan, unitCountsFromWan } = core;

function state(leaderAmount, memberAmounts = []) {
  return {
    leader: { name: "隊長", amounts: [{ id: 1, v: String(leaderAmount) }] },
    members: memberAmounts.map((amount, index) => ({
      id: index + 1,
      name: `隊員 ${index + 1}`,
      amounts: Array.isArray(amount)
        ? amount.map((value, amountIndex) => ({ id: amountIndex + 1, v: String(value) }))
        : [{ id: 1, v: String(amount) }]
    }))
  };
}

function membersAt(gateBase, count, startId = 1) {
  return Array.from({ length: count }, (_, index) => ({
    id: startId + index,
    name: `隊員 ${startId + index}`,
    amounts: [{ id: 1, v: String(gateBase) }]
  }));
}

function unitState(counts) {
  return {
    primaryOnly: true,
    leader: {
      name: "隊長",
      unitCounts: PRIMARY_GATES.map((gate) => ({
        gateIdx: gate.idx,
        v: counts[gate.idx] ?? ""
      })),
      amounts: []
    },
    members: []
  };
}

assert.equal(toWan("12,000"), 12000);
assert.equal(toWan("12,000元"), 1.2);
assert.equal(toWan("880"), 880);
assert.equal(toWan("22000"), 22000);
assert.equal(toWan("2.2億"), 22000);
assert.equal(toWan("1億2000萬"), 12000);
assert.equal(toWan("1億2000"), 12000);
assert.equal(toWan("100000000元"), 10000);
assert.equal(toWan("22000萬"), 22000);
assert.equal(toWan("-1"), 0);

assert.deepEqual(PRIMARY_GATES.map((gate) => gate.name), ["個人關", "家庭關", "事業關", "社會關", "國家關", "民族關"]);
assert.equal(leaderTotalWanFromUnitCounts([
  { gateIdx: 0, v: "13" },
  { gateIdx: 1, v: "13" },
  { gateIdx: 2, v: "13" },
  { gateIdx: 3, v: "2.625" },
  { gateIdx: 4, v: "" },
  { gateIdx: 5, v: "" }
]), 660);
assert.equal(leaderTotalWanFromUnitCounts([{ gateIdx: 0, v: "20" }]), 28.6);
assert.equal(leaderTotalWanFromUnitCounts([{ gateIdx: 0, v: "2222" }]), 28.6);

const cappedPersonal = effectiveUnitAllocation([{ gateIdx: 0, v: "20" }]);
assert.deepEqual(cappedPersonal.effectiveCounts.map((count) => Number(count.toFixed(3))), [13, 0, 0, 0, 0, 0]);

const downPlacedFamily = effectiveUnitAllocation([
  { gateIdx: 0, v: "5" },
  { gateIdx: 1, v: "20" }
]);
assert.deepEqual(downPlacedFamily.effectiveCounts.map((count) => Number(count.toFixed(3))), [13, 13, 0, 0, 0, 0]);
assert.equal(Number(downPlacedFamily.effectiveWan.toFixed(1)), 143);

const hugePersonalUnits = analyze(unitState({ 0: "2222" }));
assert.equal(hugePersonalUnits.leaderWan, 28.6);
assert.equal(hugePersonalUnits.steps[0].g.name, "個人關");
assert.equal(hugePersonalUnits.steps[0].status, "cleared");
assert.equal(hugePersonalUnits.curr.g.name, "家庭關");
assert.equal(hugePersonalUnits.phaseRows[0].passed, false);
assert.equal(Number(hugePersonalUnits.phaseRows[0].missing.toFixed(1)), 26.4);
assert.equal(hugePersonalUnits.phaseRows[0].parts[1].gateName, "家庭");
assert.equal(hugePersonalUnits.phaseRows[0].parts[1].missingUnits, 3);

const personalFiveFamilyTwenty = analyze(unitState({ 0: "5", 1: "20" }));
assert.equal(Number(personalFiveFamilyTwenty.leaderWan.toFixed(1)), 143);
assert.deepEqual(personalFiveFamilyTwenty.unitAllocation.effectiveCounts.map((count) => Number(count.toFixed(3))), [13, 13, 0, 0, 0, 0]);
assert.equal(personalFiveFamilyTwenty.steps[0].status, "cleared");
assert.equal(personalFiveFamilyTwenty.steps[1].status, "cleared");
assert.equal(personalFiveFamilyTwenty.curr.g.name, "事業關");
assert.deepEqual(personalFiveFamilyTwenty.phaseRows.map((row) => row.passed), [true, false, false, false, false]);
assert.equal(personalFiveFamilyTwenty.phaseRows[1].parts[0].missingUnits, 0);
assert.equal(personalFiveFamilyTwenty.phaseRows[1].parts[1].gateName, "事業");
assert.equal(personalFiveFamilyTwenty.phaseRows[1].parts[1].missingUnits, 3);

const unitCounts660 = unitCountsFromWan(660);
assert.deepEqual(unitCounts660.map((item) => item.v), ["13", "13", "13", "2.625", "", ""]);
assert.equal(Number(leaderTotalWanFromUnitCounts(unitCounts660).toFixed(1)), 660);
assert.deepEqual(phaseStatusForUnitCounts(effectiveUnitAllocation(unitCounts660).effectiveCounts).map((row) => row.passed), [true, true, false, false, false]);
assert.equal(Number(phaseStatusForUnitCounts(effectiveUnitAllocation(unitCounts660).effectiveCounts)[2].missing.toFixed(1)), 33);

const carryForwardTwoTwoWan = leaderTotalWanFromUnitCounts([
  { gateIdx: 0, v: "2" },
  { gateIdx: 1, v: "2" }
]);
const carryForwardTwoTwo = analyze({
  primaryOnly: true,
  leader: { name: "隊長", amounts: [{ id: 1, v: String(carryForwardTwoTwoWan) }] },
  members: []
});
assert.equal(carryForwardTwoTwoWan, 22);
assert.equal(carryForwardTwoTwo.leaderWan, 22);
assert.equal(carryForwardTwoTwo.curr.g.name, "個人關");
assert.equal(carryForwardTwoTwo.curr.status, "at_zm");
assert.equal(carryForwardTwoTwo.curr.target, "zz");
assert.equal(Number(carryForwardTwoTwo.curr.gap.toFixed(1)), 6.6);
assert.equal(carryForwardTwoTwo.xian.name, "家庭關");
const carryForwardTwoTwoCounts = countProgressForWan(carryForwardTwoTwo.curr.combined, carryForwardTwoTwo.curr.g);
assert.equal(carryForwardTwoTwoCounts.zhenMing.missing, 0);
assert.equal(carryForwardTwoTwoCounts.zhenZheng.missing, 3);

assert.equal(gateFor(2.2).name, "個人關");
assert.equal(gateFor(87).name, "事業關");
assert.equal(gateFor(88000).name, "外太空關");
assert.equal(gateFor(0), null);

assert.equal(gateFor(toWan("2.2億")).name, "太空關");
assert.equal(maxWanOf([{ v: "2.2" }, { v: "88" }, { v: "2200000元" }]), 220);
assert.equal(teamTierFor(3).label, "1:3");
assert.equal(teamTierFor(4).label, "3:5");
assert.equal(teamTierFor(13).label, "13:1");
assert.equal(teamTierFor(0), null);

assert.equal(CYCLES.length, 5);
assert.deepEqual(CYCLES.map((cycle) => cycle.name), ["小輪迴", "中輪迴", "大輪迴", "極輪迴", "極極輪迴"]);
assert.deepEqual(CYCLES.map((cycle) => cycle.passWan), [55, 550, 5500, 55000, 550000]);
assert.deepEqual(CYCLES.map((cycle) => cycle.segmentWan), [55, 638, 6380, 63800, 638000]);
assert.deepEqual(CYCLES.map((cycle) => cycle.cumulativePassWan), [55, 693, 7073, 70873, 708873]);
assert.equal(cycleStatusFor(54.9).current.name, "小輪迴");
assert.equal(cycleStatusFor(55).cleared.name, "小輪迴");
assert.equal(cycleStatusFor(55).current.name, "中輪迴");
assert.equal(cycleStatusFor(660).cleared.name, "小輪迴");
assert.equal(cycleStatusFor(660).current.name, "中輪迴");
assert.equal(cycleStatusFor(660).remaining, 33);
assert.equal(cycleStatusFor(693).cleared.name, "中輪迴");
assert.equal(cycleStatusFor(693).current.name, "大輪迴");
assert.equal(cycleStatusFor(708873).allCleared, true);

assert.deepEqual(PHASES.map((phase) => phase.name), ["第一段數", "第二段數", "第三段數", "第四段數", "第五段數"]);
assert.deepEqual(PHASES.map((phase) => phase.segmentWan), [55, 154, 484, 1540, 2860]);
assert.deepEqual(PHASES.map((phase) => phase.passWan), [55, 209, 693, 2233, 5093]);
assert.deepEqual(PHASES.map((phase) => [phase.lowerGate.name, phase.lowerBase, phase.lowerCount, phase.upperGate.name, phase.upperBase, phase.upperCount]), [
  ["個人關", 2.2, 13, "家庭關", 8.8, 3],
  ["家庭關", 8.8, 10, "事業關", 22, 3],
  ["事業關", 22, 10, "社會關", 88, 3],
  ["社會關", 88, 10, "國家關", 220, 3],
  ["國家關", 220, 10, "民族關", 220, 3]
]);
assert.deepEqual(phaseStatusFor(54.9).map((row) => row.passed), [false, false, false, false, false]);
assert.deepEqual(phaseStatusFor(55).map((row) => row.passed), [true, false, false, false, false]);
assert.deepEqual(phaseStatusFor(209).map((row) => row.passed), [true, true, false, false, false]);
assert.deepEqual(phaseStatusFor(660).map((row) => row.passed), [true, true, false, false, false]);
assert.equal(phaseStatusFor(660)[2].missing, 33);
assert.deepEqual(phaseStatusFor(693).map((row) => row.passed), [true, true, true, false, false]);
assert.deepEqual(phaseStatusFor(5093).map((row) => row.passed), [true, true, true, true, true]);

const case660 = analyze(state(660, [2.2, 2.2, 2.2]));
assert.equal(case660.leaderWan, 660);
assert.equal(case660.curr.status, "wip");
assert.equal(case660.curr.g.name, "社會關");
assert.equal(Number(case660.curr.rem.toFixed(1)), 237.6);
assert.equal(case660.curr.target, "zm");
assert.equal(Number(case660.curr.gap.toFixed(1)), 26.4);
assert.equal(case660.xian.name, "社會關");
assert.equal(case660.xianInProgress, true);
assert.equal(case660.shi.name, "事業關");
assert.equal(case660.leaderCycle.cleared.name, "小輪迴");
assert.equal(case660.leaderCycle.current.name, "中輪迴");
assert.equal(case660.leaderCycle.remaining, 33);

const case660SocialCounts = countProgressForWan(case660.curr.combined, case660.curr.g);
assert.equal(Number(case660SocialCounts.zhenMing.done.toFixed(1)), 2.7);
assert.equal(Number(case660SocialCounts.zhenMing.missing.toFixed(1)), 0.3);
assert.equal(Number(case660SocialCounts.zhenZheng.done.toFixed(1)), 2.7);
assert.equal(Number(case660SocialCounts.zhenZheng.missing.toFixed(1)), 10.3);

const case880 = analyze(state(880, [2.2, 2.2, 2.2]));
assert.equal(case880.curr.status, "at_zm");
assert.equal(case880.curr.g.name, "社會關");
assert.equal(Number(case880.curr.rem.toFixed(1)), 457.6);
assert.equal(case880.xian.name, "國家關");
assert.equal(case880.xianInProgress, false);
assert.equal(case880.shi.name, "事業關");
assert.equal(case880.leaderCycle.cleared.name, "中輪迴");
assert.equal(case880.leaderCycle.current.name, "大輪迴");
assert.equal(case880.teamCycle.current.name, "小輪迴");

const case1100 = analyze(state(1100, [2.2, 2.2, 2.2]));
assert.equal(case1100.curr.status, "at_zm");
assert.equal(case1100.xian.name, "國家關");
assert.equal(case1100.shi.name, "事業關");

const solo660 = analyze(state(660, []));
assert.equal(solo660.curr.status, "wip");
assert.equal(solo660.curr.g.name, "社會關");
assert.equal(solo660.curr.target, "zm");
assert.equal(Number(solo660.curr.gap.toFixed(1)), 33);

const exactZhenMing = analyze(state(6.6, []));
assert.equal(exactZhenMing.curr.status, "at_zm");
assert.equal(exactZhenMing.curr.target, "zz");
assert.equal(exactZhenMing.xian.name, "家庭關");

const noTeam = analyze(state(880, []));
assert.equal(noTeam.teamHighIdx, -1);
assert.equal(noTeam.shi.name, noTeam.xian.name);

const primaryOnlyHuge = analyze({ ...state(10000, []), primaryOnly: true });
assert.equal(primaryOnlyHuge.curr.g.name, "民族關");
assert.equal(primaryOnlyHuge.curr.status, "at_zm");
assert.equal(primaryOnlyHuge.xian.name, "民族關");
assert.equal(Number(primaryOnlyHuge.curr.gap.toFixed(1)), 5873);

const memberHighestOnly = calcCascade([{ v: "28.6" }], [
  { amounts: [{ v: "2.2" }, { v: "8.8" }] }
]);
assert.equal(memberHighestOnly.tc["個人關"] || 0, 0);
assert.equal(memberHighestOnly.tc["家庭關"], 1);
assert.equal(memberHighestOnly.steps[0].status, "cleared");

const cycleTeam = analyze(state(0, [55, 22, 88]));
assert.equal(cycleTeam.teamWan, 165);
assert.equal(cycleTeam.teamAmountCycle.cleared.name, "小輪迴");
assert.equal(cycleTeam.teamAmountCycle.current.name, "中輪迴");
assert.equal(cycleTeam.teamCycle.current.name, "小輪迴");
assert.equal(cycleTeam.positions[0].cycle.cleared.name, "小輪迴");
assert.equal(cycleTeam.positions[1].cycle.current.name, "小輪迴");

const smallCoveragePositions = core.memberPositions([
  ...membersAt(2.2, 13),
  ...membersAt(8.8, 3, 20)
]);
const smallCoverage = cycleStatusForTeamCoverage(smallCoveragePositions);
assert.equal(smallCoverage.cleared.name, "小輪迴");
assert.equal(smallCoverage.current.name, "中輪迴");
assert.equal(smallCoverage.remaining, 638);

const middleCoveragePositions = core.memberPositions([
  ...membersAt(2.2, 13),
  ...membersAt(8.8, 13, 20),
  ...membersAt(22, 13, 40),
  ...membersAt(88, 3, 60)
]);
const middleCoverage = cycleStatusForTeamCoverage(middleCoveragePositions);
assert.equal(middleCoverage.cleared.name, "中輪迴");
assert.equal(middleCoverage.current.name, "大輪迴");
assert.equal(middleCoverage.remaining, 6380);

const maxLeaderCycle = analyze({
  ...state(0, []),
  settings: { leaderCycleBasis: "max" },
  leader: { name: "隊長", amounts: [{ id: 1, v: "55" }, { id: 2, v: "605" }] }
});
assert.equal(maxLeaderCycle.leaderWan, 660);
assert.equal(maxLeaderCycle.leaderCycleWan, 605);
assert.equal(maxLeaderCycle.leaderCycle.current.name, "中輪迴");

const memberView = analyze({
  ...state(0, [2.2, 88]),
  settings: { viewMode: "member", selectedMemberId: 2 }
});
assert.equal(memberView.settings.viewMode, "member");
assert.equal(memberView.selectedMember.name, "隊員 2");
assert.equal(memberView.selectedMember.gate.name, "社會關");

assert.equal(GATES.length, 10);
assert.deepEqual(GATES.map((gate) => gate.base), [2.2, 8.8, 22, 88, 220, 880, 2200, 8800, 22000, 88000]);
assert.deepEqual(GATES.map((gate) => Number(gate.trueWan.toFixed(1))), [28.6, 114.4, 286, 1144, 2860, 11440, 28600, 114400, 286000, 1144000]);
assert.deepEqual(GATES.map((gate) => Number(gate.cumulativeTrueWan.toFixed(1))), [28.6, 143, 429, 1573, 4433, 15873, 44473, 158873, 444873, 1588873]);
assert.deepEqual(countProgressForUnits(13).zhenMing, { done: 3, total: 3, missing: 0 });
assert.deepEqual(countProgressForUnits(13).zhenZheng, { done: 13, total: 13, missing: 0 });
assert.deepEqual(countProgressForUnits(1).zhenMing, { done: 1, total: 3, missing: 2 });
assert.deepEqual(countProgressForUnits(1).zhenZheng, { done: 1, total: 13, missing: 12 });

console.log("calc.test.js passed");
