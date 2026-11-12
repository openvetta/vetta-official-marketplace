# Vetta Ego

Declarative Vetta plugin that makes the [ego browser](https://lite.ego.app/) the default for browser work.

| Piece | File |
| --- | --- |
| Skill (bootstrap copy of the upstream `ego-browser` skill; it runs `ego-browser skill` for the guide matching the installed version) | `agent/skills/ego-browser/` |
| System prompt that routes browser tasks to ego | `agent/prompts/prefer-ego-browser.md` |

No runtime logic: `src/index.ts` is an empty activation because the host loads every plugin via Module Federation.

When refreshing the skill, copy `SKILL.md` and `references/` from the installed ego lite (`~/.local/share/ego/ego-skills`). Do not copy `learnings/`; those are site-specific scripts that track ego versions.

```bash
npm install && npm run check && npm run build
```
