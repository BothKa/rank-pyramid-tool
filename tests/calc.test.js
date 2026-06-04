const assert = require("node:assert/strict");
const core = require("../app.js");

const { analyze, calcCascade, cycleStatusFor, CYCLES, gateFor, GATES, maxWanOf, teamTierFor, toWan } = core;

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

assert.equal(toWan("12,000"), 1.2);
assert.equal(toWan("880"), 880);
assert.equal(toWan("-1"), 0);

assert.equal(gateFor(2.2).name, "個人關");
assert.equal(gateFor(87).name, "事業關");
assert.equal(gateFor(88000).name, "外太空關");
assert.equal(gateFor(0), null);

assert.equal(maxWanOf([{ v: "2.2" }, { v: "88" }, { v: "2200000" }]), 220);
assert.equal(teamTierFor(3).label, "1:3");
assert.equal(teamTierFor(4).label, "3:5");
assert.equal(teamTierFor(13).label, "13:1");
assert.equal(teamTierFor(0), null);

assert.equal(CYCLES.length, 5);
assert.deepEqual(CYCLES.map((cycle) => cycle.name), ["小輪迴", "中輪迴", "大輪迴", "極輪迴", "極極輪迴"]);
assert.deepEqual(CYCLES.map((cycle) => cycle.passWan), [55, 550, 5500, 55000, 550000]);
assert.equal(cycleStatusFor(54.9).current.name, "小輪迴");
assert.equal(cycleStatusFor(55).cleared.name, "小輪迴");
assert.equal(cycleStatusFor(55).current.name, "中輪迴");
assert.equal(cycleStatusFor(550000).allCleared, true);

const case660 = analyze(state(660, [2.2, 2.2, 2.2]));
assert.equal(case660.leaderWan, 660);
assert.equal(case660.curr.status, "wip");
assert.equal(case660.curr.g.name, "社會關");
assert.equal(Number(case660.curr.rem.toFixed(1)), 237.6);
assert.equal(case660.xian.name, "社會關");
assert.equal(case660.xianInProgress, true);
assert.equal(case660.shi.name, "事業關");

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

const noTeam = analyze(state(880, []));
assert.equal(noTeam.teamHighIdx, -1);
assert.equal(noTeam.shi.name, noTeam.xian.name);

const memberHighestOnly = calcCascade([{ v: "28.6" }], [
  { amounts: [{ v: "2.2" }, { v: "8.8" }] }
]);
assert.equal(memberHighestOnly.tc["個人關"] || 0, 0);
assert.equal(memberHighestOnly.tc["家庭關"], 1);
assert.equal(memberHighestOnly.steps[0].status, "cleared");

const cycleTeam = analyze(state(0, [55, 22, 88]));
assert.equal(cycleTeam.teamWan, 165);
assert.equal(cycleTeam.teamCycle.cleared.name, "小輪迴");
assert.equal(cycleTeam.teamCycle.current.name, "中輪迴");
assert.equal(cycleTeam.positions[0].cycle.cleared.name, "小輪迴");
assert.equal(cycleTeam.positions[1].cycle.current.name, "小輪迴");

assert.equal(GATES.length, 10);
assert.deepEqual(GATES.map((gate) => gate.base), [2.2, 8.8, 22, 88, 220, 880, 2200, 8800, 22000, 88000]);

console.log("calc.test.js passed");
