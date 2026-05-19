import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createHttpServer } from "../src/server/httpServer.mjs";

test("local service reads and saves config", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "daily-http-"));
  const server = createHttpServer({ configPath: path.join(root, "config.json") });

  try {
    await server.listen(0);

    const initialResponse = await fetch(`http://127.0.0.1:${server.port}/api/config`);
    const initialConfig = await initialResponse.json();

    assert.equal(initialResponse.status, 200);
    assert.equal(initialConfig.codexEnabled, false);

    const nextConfig = {
      deepSeekApiKey: "secret",
      outputDirectory: path.join(root, "reports"),
      repositories: [
        {
          path: path.join(root, "repo"),
          businessName: "项目",
          keywords: ["repo"],
        },
      ],
    };

    const saveResponse = await fetch(`http://127.0.0.1:${server.port}/api/config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextConfig),
    });
    const savedConfig = await saveResponse.json();

    assert.equal(saveResponse.status, 200);
    assert.equal(savedConfig.deepSeekApiKey, "secret");
  } finally {
    await server.close();
  }
});

test("local service returns JSON errors", async () => {
  const server = createHttpServer();

  try {
    await server.listen(0);

    const response = await fetch(`http://127.0.0.1:${server.port}/api/unknown`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(body.error, /Not found/);
  } finally {
    await server.close();
  }
});

test("local service rejects mutating requests from untrusted origins", async () => {
  const server = createHttpServer();

  try {
    await server.listen(0);

    const response = await fetch(`http://127.0.0.1:${server.port}/api/report/save`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://example.com",
      },
      body: JSON.stringify({ date: "2026-05-20", markdown: "bad" }),
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.match(body.error, /origin/i);
  } finally {
    await server.close();
  }
});

test("local service allows mutating requests from trusted dev origin", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "daily-http-"));
  const server = createHttpServer({ configPath: path.join(root, "config.json") });

  try {
    await server.listen(0);

    const response = await fetch(`http://127.0.0.1:${server.port}/api/config`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:5173",
      },
      body: JSON.stringify({
        deepSeekApiKey: "",
        outputDirectory: path.join(root, "reports"),
        codexEnabled: false,
        repositories: [],
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.outputDirectory, path.join(root, "reports"));
  } finally {
    await server.close();
  }
});

test("local service rejects non-json mutating requests", async () => {
  const server = createHttpServer();

  try {
    await server.listen(0);

    const response = await fetch(`http://127.0.0.1:${server.port}/api/evidence`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ manualContext: "bad" }),
    });
    const body = await response.json();

    assert.equal(response.status, 415);
    assert.match(body.error, /application\/json/i);
  } finally {
    await server.close();
  }
});

test("local service rejects report save path traversal dates", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "daily-http-"));
  const configPath = path.join(root, "config.json");
  const outputDirectory = path.join(root, "reports");
  await writeFile(
    configPath,
    JSON.stringify({
      deepSeekApiKey: "",
      outputDirectory,
      codexEnabled: false,
      repositories: [],
    }),
    "utf8",
  );
  const server = createHttpServer({ configPath });

  try {
    await server.listen(0);

    const response = await fetch(`http://127.0.0.1:${server.port}/api/report/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "..\\..\\Desktop\\pwn", markdown: "bad", overwrite: true }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /date must be YYYY-MM-DD/);
  } finally {
    await server.close();
  }
});
