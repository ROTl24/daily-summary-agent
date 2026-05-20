export function isReportAlreadyExistsError(message) {
  return /\.md already exists\.$/.test(String(message || "").trim());
}
