import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { loadAppConfig, saveAppConfig } from "../appConfig.mjs";
import { collectEvidence, validateRepositoryPath } from "../evidenceService.mjs";
import { generateReportFromEvidence, saveReportFile } from "../reportService.mjs";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
]);

export function createHttpServer({ configPath, staticDirectory = path.join(process.cwd(), "dist") } = {}) {
  const server = http.createServer((request, response) => {
    handleRequest(request, response, { configPath, staticDirectory }).catch((error) => {
      sendJson(response, error.statusCode || 500, { error: error.message || "Internal server error." });
    });
  });

  return {
    get port() {
      const address = server.address();
      return typeof address === "object" && address !== null ? address.port : undefined;
    },
    listen(port = 0) {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }

        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

async function handleRequest(request, response, options) {
  const url = new URL(request.url || "/", "http://127.0.0.1");

  if (url.pathname.startsWith("/api/")) {
    await handleApiRequest(request, response, url, options.configPath);
    return;
  }

  if (request.method === "GET") {
    await serveStaticFile(response, url.pathname, options.staticDirectory);
    return;
  }

  throw httpError(404, "Not found.");
}

async function handleApiRequest(request, response, url, configPath) {
  if (request.method === "GET" && url.pathname === "/api/config") {
    sendJson(response, 200, await loadAppConfig({ configPath }));
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/config") {
    sendJson(response, 200, await saveAppConfig(await readJson(request), { configPath }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/repositories/validate") {
    const body = await readJson(request);
    sendJson(response, 200, await validateRepositoryPath(body.path));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/evidence") {
    const body = await readJson(request);
    const config = await loadAppConfig({ configPath });
    sendJson(
      response,
      200,
      await collectEvidence({ config, manualContext: body.manualContext, date: body.date }),
    );
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/generate") {
    const evidence = await readJson(request);
    const config = await loadAppConfig({ configPath });
    sendJson(response, 200, await generateReportFromEvidence({ config, evidence }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/report/save") {
    const body = await readJson(request);
    const config = await loadAppConfig({ configPath });
    sendJson(
      response,
      200,
      await saveReportFile({
        outputDirectory: config.outputDirectory,
        date: body.date,
        markdown: body.markdown,
        overwrite: Boolean(body.overwrite),
      }),
    );
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.setEncoding("utf8");
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => {
      const raw = chunks.join("");
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(httpError(400, `Invalid JSON: ${error.message}`));
      }
    });
  });
}

async function serveStaticFile(response, pathname, staticDirectory) {
  const root = path.resolve(staticDirectory);
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const filePath = path.resolve(root, relativePath);

  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    throw httpError(404, "Not found.");
  }

  const fileStat = await stat(filePath).catch((error) => {
    if (error.code === "ENOENT") {
      throw httpError(404, "Not found.");
    }

    throw error;
  });

  if (!fileStat.isFile()) {
    throw httpError(404, "Not found.");
  }

  response.writeHead(200, {
    "content-type": contentTypes.get(path.extname(filePath)) || "application/octet-stream",
  });
  await pipeline(createReadStream(filePath), response);
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
