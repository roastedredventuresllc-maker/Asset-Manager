import { Router, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { verifyToken } from "../lib/auth.js";
import { buildMcpServer } from "../mcp/server.js";
import { logger } from "../lib/logger.js";

const router = Router();

/** Extract a LaunchPad magic-link token from the request headers. */
function extractToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) return token;
  }
  const custom = req.headers["x-launchpad-token"];
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  return null;
}

function unauthorized(res: Response, message: string): void {
  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message },
    id: null,
  });
}

// POST /api/mcp — Streamable HTTP transport (stateless: one server per request)
router.post("/", async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    return unauthorized(
      res,
      "Unauthorized: supply a LaunchPad token via the 'Authorization: Bearer <token>' header.",
    );
  }

  const auth = await verifyToken(token);
  if (!auth) {
    return unauthorized(res, "Unauthorized: invalid or expired LaunchPad token.");
  }

  const server = buildMcpServer(auth);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    logger.error({ err }, "MCP request error");
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// The stateless transport does not support server-initiated streams or sessions.
function methodNotAllowed(_req: Request, res: Response): void {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. The LaunchPad MCP endpoint only accepts POST.",
    },
    id: null,
  });
}

router.get("/", methodNotAllowed);
router.delete("/", methodNotAllowed);

export default router;
