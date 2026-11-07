# LinguaLab

Interactive syntax-tree and X-bar analysis for linguistics students. Founded by Shes Mansoor.

## How it works
- `index.html` – the whole website (no build step).
- `netlify/functions/analyze.mjs` – public: checks the verified library, then the waiting list, then asks Claude (and validates the answer before saving it as *AI Generated*).
- `netlify/functions/library.mjs` – public: lists owner-approved trees.
- `netlify/functions/owner.mjs` – private review queue (needs the owner token).
- `netlify/functions/lib/shared.mjs` – shared rules, prompts and checks.

## Netlify environment variables
| Name | Needed | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Secret. Never put it in GitHub. |
| `REVIEW_ADMIN_TOKEN` | yes | Long random secret; it is your owner password. |
| `ANTHROPIC_MODEL` | no | Leave unset unless the owner page says the model name is not found. |
| `DAILY_AI_LIMIT` | no | Default 150 AI analyses per day for the whole site. |
| `PER_IP_DAILY_LIMIT` | no | Default 40 per visitor per day. |

## Owner page
Open `/#owner` (it is not linked anywhere), enter the token, review the waiting list, tick the books you actually checked against, then approve.

## Rule of thumb
AI output is never "Linguist Verified" until the owner approves it.
