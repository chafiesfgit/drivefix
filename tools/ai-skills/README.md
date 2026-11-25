# AI skills (optional)

The frontend was built with [Claude Code](https://claude.com/claude-code) and a set of **skills**: instruction packs
that teach it React, animation and design rules. They are **not needed** to run or change the project. Install them
only if you use Claude Code and want the same setup.

Skills are installed for your user, in `%USERPROFILE%\.claude\skills`, not in this repository.

| Script | Installs | From |
| --- | --- | --- |
| `install-skills.ps1` | `react-best-practices`, `composition-patterns`, `react-view-transitions`, `web-design-guidelines` | vercel-labs/agent-skills |
| | Emil Kowalski design-engineering and animation skills (`emil-design-eng`, `animate`, `choreograph`, `animation-performance`, `improve-animations`, `break-ui`, ...) | emilkowalski/skills |
| | Official GSAP skills (`gsap-core`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-plugins`, `gsap-performance`, ...) | greensock/gsap-skills |
| | `unslop` (avoids generic "AI-looking" UI) | heydamir/unslop |
| `install-caveman.ps1` | `caveman`, `ultracave`, `megacave` (shorter answers from Claude) | JuliusBrussee/caveman |

Run from this folder (needs Git):

```powershell
powershell -ExecutionPolicy Bypass -File .\install-skills.ps1
powershell -ExecutionPolicy Bypass -File .\install-caveman.ps1   # optional
```

Then restart Claude Code. The list of skills each prompt used is in [`../../docs/ai-prompts/PROMPTS.md`](../../docs/ai-prompts/PROMPTS.md).
