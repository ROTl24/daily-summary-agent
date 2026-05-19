import { createHttpServer } from "./httpServer.mjs";

const port = Number(readArgument("--port") || process.env.PORT || 8787);
const staticDirectory = readArgument("--static");
const server = createHttpServer({ staticDirectory });

await server.listen(port);

console.log(`Daily Summary Agent service listening on http://127.0.0.1:${server.port}`);

function readArgument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}
