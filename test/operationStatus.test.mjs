import test from "node:test";
import assert from "node:assert/strict";

import { getReportFeedback, getStatusTone } from "../web/src/operationStatus.js";

test("getReportFeedback shows a visible generating state", () => {
  assert.deepEqual(getReportFeedback({ reportState: "generating", error: "" }), {
    tone: "busy",
    text: "正在生成日报，请稍候。DeepSeek 返回前请不要重复点击。",
  });
});

test("getReportFeedback shows a visible failure state", () => {
  assert.deepEqual(getReportFeedback({ reportState: "error", error: "API key invalid" }), {
    tone: "error",
    text: "生成失败：API key invalid",
  });
});

test("getReportFeedback shows a visible success state", () => {
  assert.deepEqual(getReportFeedback({ reportState: "success", error: "" }), {
    tone: "success",
    text: "日报已生成，可在右侧编辑并保存。",
  });
});

test("getStatusTone maps operation state to top bar tone", () => {
  assert.equal(getStatusTone({ activeTask: "generating", error: "" }), "busy");
  assert.equal(getStatusTone({ activeTask: "idle", error: "failed" }), "error");
  assert.equal(getStatusTone({ activeTask: "idle", error: "" }), "neutral");
});
