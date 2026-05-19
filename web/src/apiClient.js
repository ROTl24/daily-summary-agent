export async function getConfig() {
  return request("/api/config");
}

export async function saveConfig(config) {
  return request("/api/config", {
    method: "PUT",
    body: config,
  });
}

export async function validateRepository(path) {
  return request("/api/repositories/validate", {
    method: "POST",
    body: { path },
  });
}

export async function collectEvidence({ manualContext, date } = {}) {
  return request("/api/evidence", {
    method: "POST",
    body: { manualContext, date },
  });
}

export async function generateReport(evidence) {
  return request("/api/generate", {
    method: "POST",
    body: evidence,
  });
}

export async function saveReport({ date, markdown, overwrite }) {
  return request("/api/report/save", {
    method: "POST",
    body: { date, markdown, overwrite },
  });
}

async function request(path, options = {}) {
  const { body, headers, ...fetchOptions } = options;
  const response = await fetch(path, {
    ...fetchOptions,
    headers: body === undefined ? headers : { ...headers, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}
