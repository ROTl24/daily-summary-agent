import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
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
