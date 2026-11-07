// Private review queue. Every call needs  Authorization: Bearer <REVIEW_ADMIN_TOKEN>.
// Actions: list | approve | reject | revoke | ping
import {
  AppError, json, errorResponse, requireOwner, stores, listAll, usageToday, callClaude, VALID_REFS,
} from "./lib/shared.mjs";

const isId = (s) => typeof s === "string" && /^[a-f0-9]{40}$/.test(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD", message: "Use POST." }, 405);
  try {
    try { requireOwner(req); }
    catch (e) { if (e.code === "UNAUTHORISED") await sleep(700); throw e; } // slows down guessing

    const body = await req.json().catch(() => ({}));
    const { verified, pending, meta } = await stores();
    const now = new Date().toISOString();
    const needId = () => { if (!isId(body.id)) throw new AppError("BAD_INPUT", "Bad id.", 400); return body.id; };

    switch (body.action) {
      case "list": {
        const [p, v, usage] = await Promise.all([listAll(pending), listAll(verified), usageToday(meta)]);
        return json({ pending: p, verified: v, usage });
      }
      case "approve": {
        const id = needId();
        const rec = await pending.get(id, { type: "json" });
        if (!rec) throw new AppError("NOT_FOUND", "That item is no longer in the waiting list.", 404);
        const refs = Array.isArray(body.refs) ? body.refs.filter((r) => VALID_REFS.includes(r)) : [];
        await verified.setJSON(id, { ...rec, status: "verified", refs, reviewedAt: now });
        await pending.delete(id);
        return json({ ok: true });
      }
      case "reject": { await pending.delete(needId()); return json({ ok: true }); }
      case "revoke": {
        const id = needId();
        const rec = await verified.get(id, { type: "json" });
        if (!rec) throw new AppError("NOT_FOUND", "That item is not in the verified set.", 404);
        const { reviewedAt, ...rest } = rec;
        await pending.setJSON(id, { ...rest, status: "pending", refs: [] });
        await verified.delete(id);
        return json({ ok: true });
      }
      case "ping": {
        const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
        if (!hasKey) return json({ ok: false, hasKey, message: "ANTHROPIC_API_KEY is not set in Netlify." });
        try {
          const r = await callClaude("Reply with the single word OK.", { maxTokens: 10, system: "Reply briefly." });
          return json({ ok: true, hasKey, model: r.model, message: "The AI connection works." });
        } catch (e) {
          return json({ ok: false, hasKey, code: e.code, message: e.message, detail: e.detail || "" });
        }
      }
      default:
        throw new AppError("BAD_INPUT", "Unknown action.", 400);
    }
  } catch (e) {
    return errorResponse(e);
  }
};
