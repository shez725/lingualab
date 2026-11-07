// Public endpoint: analyse one sentence (mode "psr") or one phrase (mode "xbar").
// Order of work: verified library -> waiting queue -> (budget check) -> Claude -> validate -> save as pending.
import {
  AppError, json, errorResponse, checkInput, normalise, keyFor, stores, takeBudget,
  buildPrompt, callClaude, parseModelJson, validateResult, publicView, XBAR_CATS,
} from "./lib/shared.mjs";

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "METHOD", message: "Use POST." }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "xbar" ? "xbar" : "psr";
    const cat = mode === "xbar" ? (XBAR_CATS.includes(body.cat) ? body.cat : "auto") : "-";
    const det = mode === "xbar" ? (body.det === "dp" ? "dp" : "np") : "-";
    const text = checkInput(mode, body.text);
    const key = keyFor(mode, cat, det, normalise(text));
    const { verified, pending, meta } = await stores();

    const v = await verified.get(key, { type: "json" });
    if (v) return json({ status: "verified", record: publicView(v) });
    const p = await pending.get(key, { type: "json" });
    if (p) return json({ status: "pending", record: publicView(p) });

    const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
    const budget = await takeBudget(meta, ip);
    if (!budget.ok) {
      return json({ error: "LIMIT", message: "Today's free AI analyses have been used up. Open the Verified Library, or try again tomorrow." }, 429);
    }

    let result = null, model = "", reason = "";
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const out = await callClaude(buildPrompt(mode, cat, det, text, reason));
      model = out.model;
      try {
        result = validateResult(mode, cat, det, text, parseModelJson(out.text));
      } catch (e) {
        if (e instanceof AppError && e.code === "BAD_TREE") reason = e.message;
        else throw e;
      }
    }
    if (!result) throw new AppError("BAD_TREE", "The AI could not produce a valid tree for this input. Try rewording it.", 422);
    if (result.unsupported) return json({ status: "unsupported", reason: result.unsupported });

    const rec = {
      id: key, mode, cat, det, text, norm: normalise(text),
      tree: result.tree, notes: result.notes, pitfalls: result.pitfalls,
      status: "pending", createdAt: new Date().toISOString(), model,
    };
    await pending.setJSON(key, rec);
    return json({ status: "pending", record: publicView(rec) });
  } catch (e) {
    return errorResponse(e);
  }
};
