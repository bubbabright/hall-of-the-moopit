import { GAMES } from "@/lib/games";
import { json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

export function GET(req: Request) {
  const origin = req.headers.get("origin");
  return json(
    origin,
    GAMES.map((g) => ({
      id: g.id,
      name: g.name,
      url: g.url,
      modes: g.modes,
    })),
  );
}
