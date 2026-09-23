import assert from "node:assert/strict";
import { evaluateWriteConfirmation } from "../lib/agent/confirmation";
import { addIsoDays, getOrder } from "../lib/data/orders";
import { resetReturnStore } from "../lib/data/returns";
import { retrievePolicies } from "../lib/data/policies";
import {
  RETURN_WINDOW_DAYS,
  assessReturnEligibility,
} from "../lib/tools/check-return-eligibility";
import { createReturnTool } from "../lib/tools/create-return";

resetReturnStore();

const happyPath = getOrder("BKL-1042");
assert.ok(happyPath?.deliveredAt);
const dune = happyPath.items.find((item) => item.title === "Dune");
const hailMary = happyPath.items.find((item) => item.title === "Project Hail Mary");
assert.ok(dune && hailMary);

const duneEligibility = assessReturnEligibility("bkl-1042", dune.id);
assert.equal(duneEligibility.eligible, true);
assert.equal(duneEligibility.refundAmount, 18.99);
assert.equal(duneEligibility.returnDeadline, addIsoDays(happyPath.deliveredAt, RETURN_WINDOW_DAYS));

const hailEligibility = assessReturnEligibility("BKL-1042", hailMary.id);
assert.equal(hailEligibility.eligible, true);
assert.equal(hailEligibility.refundAmount, 16.99);

assert.equal(assessReturnEligibility("BKL-1043", "itm_1043_piranesi").eligible, false);
assert.match(
  assessReturnEligibility("BKL-1043", "itm_1043_piranesi").reason,
  /delivered/i,
);

const expired = assessReturnEligibility("BKL-1044", "itm_1044_left_hand");
assert.equal(expired.eligible, false);
assert.match(expired.reason, /30-day return window closed/);

assert.equal(assessReturnEligibility("BKL-1045", "itm_1045_circe").eligible, false);
assert.match(assessReturnEligibility("BKL-1045", "itm_1045_circe").reason, /already been refunded/);
assert.equal(assessReturnEligibility("BKL-1045", "itm_1045_vanishing").eligible, true);

assert.equal(assessReturnEligibility("BKL-1046", "itm_1046_tomorrow").eligible, false);
assert.equal(assessReturnEligibility("BKL-9999", dune.id).eligible, false);
assert.equal(assessReturnEligibility("BKL-1042", "itm_missing").eligible, false);

const blocked = evaluateWriteConfirmation("create_return", [
  { role: "assistant", content: "Which book would you like to return: Dune or Project Hail Mary?" },
  { role: "user", content: "Dune" },
]);
assert.equal(blocked.allowed, false);

const allowed = evaluateWriteConfirmation("create_return", [
  {
    role: "assistant",
    content: "Dune is eligible for a refund of $18.99. Would you like me to create the return?",
  },
  { role: "user", content: "Yes" },
]);
assert.equal(allowed.allowed, true);

const sureThing = evaluateWriteConfirmation("create_return", [
  { role: "assistant", content: "Would you like me to create the return?" },
  { role: "user", content: "Sure thing" },
]);
assert.equal(sureThing.allowed, true);

const earlyYes = evaluateWriteConfirmation("create_return", [
  { role: "assistant", content: "Hi — I can check an order, walk through a return, or explain Bookly policy." },
  { role: "user", content: "Yes, please return Dune" },
]);
assert.equal(earlyYes.allowed, false);

const humanRequest = evaluateWriteConfirmation("escalate_to_human", [
  { role: "user", content: "Can I talk to a human?" },
]);
assert.equal(humanRequest.allowed, true);

const unsolicitedEscalation = evaluateWriteConfirmation("escalate_to_human", [
  { role: "user", content: "Where is my order?" },
]);
assert.equal(unsolicitedEscalation.allowed, false);

const refused = createReturnTool.execute({
  orderId: "BKL-1044",
  itemId: "itm_1044_left_hand",
  reason: null,
});
assert.equal(refused.success, false);

const created = createReturnTool.execute({
  orderId: "BKL-1042",
  itemId: dune.id,
  reason: "Changed my mind",
});
assert.equal(created.success, true);
if (created.success) {
  assert.equal(created.returnId, "RET-8817");
  assert.equal(created.refundAmount, 18.99);
  assert.equal(created.status, "created");
}

const secondAttempt = assessReturnEligibility("BKL-1042", dune.id);
assert.equal(secondAttempt.eligible, false);
assert.match(secondAttempt.reason, /RET-8817/);

assert.equal(retrievePolicies("returns")[0]?.topic, "returns");
assert.equal(retrievePolicies("password reset")[0]?.topic, "password reset");
assert.equal(retrievePolicies("shipping")[0]?.topic, "shipping");
assert.deepEqual(retrievePolicies("not a real topic"), []);

console.log("Bookly tool checks passed.");
