// Public endpoint: the list of owner-approved ("Linguist Verified") trees.
import { json, errorResponse, stores, listAll, publicView } from "./lib/shared.mjs";

export default async (req) => {
  if (req.method !== "GET") return json({ error: "METHOD" }, 405);
  try {
    const { verified } = await stores();
    const items = (await listAll(verified)).map(publicView);
    return json({ items }, 200, { "Cache-Control": "public, max-age=60" });
  } catch (e) {
    return errorResponse(e);
  }
};
