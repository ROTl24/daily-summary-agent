import test from "node:test";
import assert from "node:assert/strict";

import { isReportAlreadyExistsError } from "../web/src/reportSaveState.js";

test("isReportAlreadyExistsError detects saved report conflicts", () => {
  assert.equal(
    isReportAlreadyExistsError("C:\\Users\\Administrator\\Desktop\\日报测试\\2026-05-20-daily.md already exists."),
    true,
  );
  assert.equal(isReportAlreadyExistsError("Report date must be YYYY-MM-DD."), false);
  assert.equal(isReportAlreadyExistsError(""), false);
});
