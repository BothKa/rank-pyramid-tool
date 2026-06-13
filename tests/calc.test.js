const assert = require("node:assert/strict");
const core = require("../app.js");

const { analyze, calcCascade, countProgressForUnits, countProgressForWan, cycleStatusFor, cycleStatusForTeamCoverage, effectiveUnitAllocation, CYCLES, DON_RANGES, gateFor, GATES, PHASES, PRIMARY_GATES, leaderTotalWanFromUnitCounts, rawLeaderTotalWanFromUnitCounts, maxWanOf, phaseStatusFor, phaseStatusForUnitCounts, primaryGateForWan, teamTierFor, toWan, unitCountsFromAmounts, unitCountsFromRangeScores, unitCountsFromWan } = core;

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

assert.deepEqual(PRIMARY_GATES.map((gate) => gate.name), ["111丼", "222丼", "333丼", "444丼", "555丼", "666丼"]);
assert.deepEqual(DON_RANGES.map((range) => [range.label, range.gate.name]), [
  ["2.2萬～未滿 8.8萬", "111丼"],
  ["8.8萬～未滿 22萬", "222丼"],
  ["22萬～未滿 88萬", "333丼"],
  ["88萬～未滿 220萬", "444丼"],
  ["220萬～未滿 880萬", "555丼"],
  ["880萬以上", "666丼"]
]);
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
assert.equal(Number(rawLeaderTotalWanFromUnitCounts([{ gateIdx: 0, v: "2222" }]).toFixed(1)), 4888.4);
assert.equal(primaryGateForWan(8.79).name, "111丼");
assert.equal(primaryGateForWan(8.8).name, "222丼");
assert.equal(primaryGateForWan(21.99).name, "222丼");
assert.equal(primaryGateForWan(22).name, "333丼");
assert.equal(primaryGateForWan(879.99).name, "555丼");
assert.equal(primaryGateForWan(880).name, "666丼");
assert.deepEqual(unitCountsFromAmounts([
  { v: "2.2" },
  { v: "8.79" },
  { v: "8.8" },
  { v: "21.99" },
  { v: "22" },
  { v: "87.99" },
  { v: "88" },
  { v: "879.99" },
  { v: "880" }
]).map((item) => item.v), ["2", "2", "2", "1", "1", "1"]);
assert.deepEqual(unitCountsFromAmounts([{ v: "660" }]).map((item) => item.v), ["", "", "", "", "1", ""]);
assert.deepEqual(unitCountsFromRangeScores([{ gateIdx: 0, v: "22" }]).map((item) => item.v), ["10", "", "", "", "", ""]);
assert.deepEqual(unitCountsFromRangeScores([
  { gateIdx: 0, v: "6.6" },
  { gateIdx: 1, v: "44" },
  { gateIdx: 5, v: "11440" }
]).map((item) => item.v), ["3", "5", "", "", "", "13"]);
assert.deepEqual(
  effectiveUnitAllocation(unitCountsFromRangeScores([{ gateIdx: 1, v: "88" }])).effectiveCounts.map((count) => Number(count.toFixed(3))),
  [13, 6.75, 0, 0, 0, 0]
);

const thirteenSixSixSix = analyze(unitState({ 5: "13" }));
assert.equal(thirteenSixSixSix.steps[5].g.name, "666丼");
assert.equal(thirteenSixSixSix.steps[5].status, "at_zm");
assert.equal(Number(thirteenSixSixSix.steps[5].totalUnits.toFixed(3)), 7.963);
assert.equal(Number(thirteenSixSixSix.unitAllocation.effectiveCounts[5].toFixed(3)), 7.963);

const cappedPersonal = effectiveUnitAllocation([{ gateIdx: 0, v: "20" }]);
assert.deepEqual(cappedPersonal.effectiveCounts.map((count) => Number(count.toFixed(3))), [13, 0, 0, 0, 0, 0]);
assert.equal(Number(cappedPersonal.rawWan.toFixed(1)), 44);
assert.equal(Number(cappedPersonal.effectiveWan.toFixed(1)), 28.6);

const familyOnlyThirteen = effectiveUnitAllocation([{ gateIdx: 1, v: "13" }]);
assert.deepEqual(familyOnlyThirteen.rawCounts.map((count) => Number(count.toFixed(3))), [0, 13, 0, 0, 0, 0]);
assert.deepEqual(familyOnlyThirteen.effectiveCounts.map((count) => Number(count.toFixed(3))), [13, 9.75, 0, 0, 0, 0]);
assert.equal(Number(familyOnlyThirteen.effectiveWan.toFixed(1)), 114.4);

const familyThirteenState = analyze(unitState({ 1: "13" }));
assert.equal(Number(familyThirteenState.leaderScoreWan.toFixed(1)), 114.4);
assert.deepEqual(familyThirteenState.phaseRows.map((row) => row.passed), [true, false, false, false, false]);
assert.equal(familyThirteenState.phaseRows[0].parts[0].gateName, "111丼");
assert.equal(familyThirteenState.phaseRows[0].parts[0].missingUnits, 0);
assert.equal(familyThirteenState.phaseRows[0].parts[1].gateName, "222丼");
assert.equal(familyThirteenState.phaseRows[0].parts[1].missingUnits, 0);

const downPlacedFamily = effectiveUnitAllocation([
  { gateIdx: 0, v: "5" },
  { gateIdx: 1, v: "20" }
]);
assert.deepEqual(downPlacedFamily.rawCounts.map((count) => Number(count.toFixed(3))), [5, 20, 0, 0, 0, 0]);
assert.deepEqual(downPlacedFamily.effectiveCounts.map((count) => Number(count.toFixed(3))), [13, 13, 0, 0, 0, 0]);
assert.equal(Number(downPlacedFamily.effectiveWan.toFixed(1)), 143);
assert.equal(Number(downPlacedFamily.rawWan.toFixed(1)), 187);

const ethnicOnlyOne = analyze(unitState({ 5: "1" }));
assert.equal(Number(ethnicOnlyOne.leaderScoreWan.toFixed(1)), 880);
assert.deepEqual(ethnicOnlyOne.unitAllocation.effectiveCounts.map((count) => Number(count.toFixed(3))), [13, 13, 13, 5.125, 0, 0]);
assert.deepEqual(ethnicOnlyOne.phaseRows.map((row) => row.passed), [true, true, true, false, false]);
assert.equal(ethnicOnlyOne.curr.g.name, "444丼");

const hugePersonalUnits = analyze(unitState({ 0: "2222" }));
assert.equal(hugePersonalUnits.leaderWan, 28.6);
assert.equal(hugePersonalUnits.steps[0].g.name, "111丼");
assert.equal(hugePersonalUnits.steps[0].status, "cleared");
assert.equal(hugePersonalUnits.curr, null);
assert.equal(hugePersonalUnits.last.g.name, "111丼");
assert.equal(hugePersonalUnits.phaseRows[0].passed, false);
assert.equal(Number(hugePersonalUnits.phaseRows[0].missing.toFixed(1)), 26.4);
assert.equal(hugePersonalUnits.phaseRows[0].parts[1].gateName, "222丼");
assert.equal(hugePersonalUnits.phaseRows[0].parts[1].missingUnits, 3);

const personalFiveFamilyTwenty = analyze(unitState({ 0: "5", 1: "20" }));
assert.equal(Number(personalFiveFamilyTwenty.leaderWan.toFixed(1)), 143);
assert.deepEqual(personalFiveFamilyTwenty.unitAllocation.effectiveCounts.map((count) => Number(count.toFixed(3))), [13, 13, 0, 0, 0, 0]);
assert.equal(personalFiveFamilyTwenty.steps[0].status, "cleared");
assert.equal(personalFiveFamilyTwenty.steps[1].status, "cleared");
assert.equal(personalFiveFamilyTwenty.curr, null);
assert.deepEqual(personalFiveFamilyTwenty.phaseRows.map((row) => row.passed), [true, false, false, false, false]);
assert.equal(personalFiveFamilyTwenty.phaseRows[1].parts[0].missingUnits, 0);
assert.equal(personalFiveFamilyTwenty.phaseRows[1].parts[1].gateName, "333丼");
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
assert.equal(carryForwardTwoTwo.curr.g.name, "111丼");
assert.equal(carryForwardTwoTwo.curr.status, "at_zm");
assert.equal(carryForwardTwoTwo.curr.target, "zz");
assert.equal(Number(carryForwardTwoTwo.curr.gap.toFixed(1)), 6.6);
assert.equal(carryForwardTwoTwo.xian.name, "222丼");
const carryForwardTwoTwoCounts = countProgressForWan(carryForwardTwoTwo.curr.combined, carryForwardTwoTwo.curr.g);
assert.equal(carryForwardTwoTwoCounts.zhenMing.missing, 0);
assert.equal(carryForwardTwoTwoCounts.zhenZheng.missing, 3);

assert.equal(gateFor(2.2).name, "111丼");
assert.equal(gateFor(87).name, "333丼");
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
  ["111丼", 2.2, 13, "222丼", 8.8, 3],
  ["222丼", 8.8, 10, "333丼", 22, 3],
  ["333丼", 22, 10, "444丼", 88, 3],
  ["444丼", 88, 10, "555丼", 220, 3],
  ["555丼", 220, 10, "666丼", 220, 3]
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
assert.equal(case660.curr.g.name, "444丼");
assert.equal(Number(case660.curr.rem.toFixed(1)), 237.6);
assert.equal(case660.curr.target, "zm");
assert.equal(Number(case660.curr.gap.toFixed(1)), 26.4);
assert.equal(case660.xian.name, "444丼");
assert.equal(case660.xianInProgress, true);
assert.equal(case660.shi.name, "333丼");
assert.equal(case660.leaderCycle.cleared.name, "小輪迴");
assert.equal(case660.leaderCycle.current.name, "中輪迴");
assert.equal(case660.leaderCycle.remaining, 33);

const case660SocialCounts = countProgressForWan(case660.curr.combined, case660.curr.g);
assert.equal(Number(case660SocialCounts.zhenMing.done.toFixed(1)), 2.7);
assert.equal(Number(case660SocialCounts.zhenMing.missing.toFixed(1)), 0.3);
assert.equal(Number(case660SocialCounts.zhenZheng.done.toFixed(1)), 0);
assert.equal(Number(case660SocialCounts.zhenZheng.missing.toFixed(1)), 10);

const case880 = analyze(state(880, [2.2, 2.2, 2.2]));
assert.equal(case880.curr.status, "at_zm");
assert.equal(case880.curr.g.name, "444丼");
assert.equal(Number(case880.curr.rem.toFixed(1)), 457.6);
assert.equal(case880.xian.name, "555丼");
assert.equal(case880.xianInProgress, false);
assert.equal(case880.shi.name, "333丼");
assert.equal(case880.leaderCycle.cleared.name, "中輪迴");
assert.equal(case880.leaderCycle.current.name, "大輪迴");
assert.equal(case880.teamCycle.current.name, "小輪迴");

const case1100 = analyze(state(1100, [2.2, 2.2, 2.2]));
assert.equal(case1100.curr.status, "at_zm");
assert.equal(case1100.xian.name, "555丼");
assert.equal(case1100.shi.name, "333丼");

const solo660 = analyze(state(660, []));
assert.equal(solo660.curr.status, "wip");
assert.equal(solo660.curr.g.name, "444丼");
assert.equal(solo660.curr.target, "zm");
assert.equal(Number(solo660.curr.gap.toFixed(1)), 33);

const exactZhenMing = analyze(state(6.6, []));
assert.equal(exactZhenMing.curr.status, "at_zm");
assert.equal(exactZhenMing.curr.target, "zz");
assert.equal(exactZhenMing.xian.name, "222丼");

const noTeam = analyze(state(880, []));
assert.equal(noTeam.teamHighIdx, -1);
assert.equal(noTeam.shi.name, noTeam.xian.name);

const primaryOnlyHuge = analyze({ ...state(10000, []), primaryOnly: true });
assert.equal(primaryOnlyHuge.curr.g.name, "666丼");
assert.equal(primaryOnlyHuge.curr.status, "at_zm");
assert.equal(primaryOnlyHuge.xian.name, "666丼");
assert.equal(Number(primaryOnlyHuge.curr.gap.toFixed(1)), 5873);

const memberHighestOnly = calcCascade([{ v: "28.6" }], [
  { amounts: [{ v: "2.2" }, { v: "8.8" }] }
]);
assert.equal(memberHighestOnly.tc["111丼"] || 0, 0);
assert.equal(memberHighestOnly.tc["222丼"], 1);
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
assert.equal(memberView.selectedMember.gate.name, "444丼");

assert.equal(GATES.length, 10);
assert.deepEqual(GATES.map((gate) => gate.base), [2.2, 8.8, 22, 88, 220, 880, 2200, 8800, 22000, 88000]);
assert.deepEqual(GATES.map((gate) => Number(gate.trueWan.toFixed(1))), [28.6, 114.4, 286, 1144, 2860, 11440, 28600, 114400, 286000, 1144000]);
assert.deepEqual(GATES.map((gate) => Number(gate.cumulativeTrueWan.toFixed(1))), [28.6, 143, 429, 1573, 4433, 15873, 44473, 158873, 444873, 1588873]);
assert.deepEqual(countProgressForUnits(13).zhenMing, { done: 3, total: 3, missing: 0 });
assert.deepEqual(countProgressForUnits(13).zhenZheng, { done: 10, total: 10, missing: 0 });
assert.deepEqual(countProgressForUnits(1).zhenMing, { done: 1, total: 3, missing: 2 });
assert.deepEqual(countProgressForUnits(1).zhenZheng, { done: 0, total: 10, missing: 10 });

console.log("calc.test.js passed");
