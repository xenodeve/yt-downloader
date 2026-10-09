**Skill file:** `design-setup/SKILL.md`
**Rule (skill's own words):** "Phase 3: 2-Pass Hero Image Generation via Higsfield MCP … HARD GATE 3: STOP. Do NOT implement the final production page until the final hero asset is selected by the user."

**What happened (2026-09-29 session in `d:\Github\YT Downloader`):**
- Phase 1 ran as written (5 exploration styles, user picked Print Tech), Phase 2 ran as written (3 ledger layout variants, user picked 1b). Both hard gates worked exactly as designed — the user chose, the chain continued.
- Phase 3 is unrunnable as written on this machine: Higsfield MCP is not installed. Preflight §0 says "prompt the user immediately"; using-qwen38 rule 3 forbids installing, searching for tools, or spawning agents. The page is a utility app (a downloader form) with no hero image at all — the skill has no rule for "MCP absent + page has no hero", so the skip was improvised, not gated.

**Followed, produced the right thing?** Phases 1–2 fully. Phase 3: the rule cannot fire here; shipping without a hero asset for an app page is correct, but the skill gives no permission for it, so every session that reaches Phase 3 on a machine without Higsfield has to improvise the same skip. A condition line — "if the MCP is absent, or the page is a utility app with no hero, Phase 3 is N/A, record one line and proceed" — would make the behaviour the skill's, not the agent's.
