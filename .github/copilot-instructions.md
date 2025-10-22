## Copilot instructions for this repository

Repository state (discovered):
- Top-level folder: `BabblinGo/` (contains only a macOS `.DS_Store` file at time of inspection).
- No `README.md`, `package.json`, `pyproject.toml`, `Dockerfile`, or CI workflows were found.

If you are an automated coding agent arriving here, do not assume any hidden conventions — this repo is effectively empty. Follow the steps below to be immediately productive.

1) Quick discovery checklist (run these locally and record results in the PR description)

```bash
# list top-level files
ls -la

# look for common language manifests
ls **/package.json **/pyproject.toml **/requirements.txt **/go.mod 2>/dev/null || true

# show git status and branches
git status --porcelain
git branch --show-current
```

2) First actions to propose and implement
- If the goal is to start development, create a minimal README.md describing the project's purpose and a small scaffold for the chosen language (ask the user which language to use if unclear).
- If a language is detectable (e.g., `package.json` for Node, `pyproject.toml` for Python), prefer using the detected ecosystem and add a small CI job.
- For an empty repo, propose a concrete tiny first PR: add `README.md`, a `.gitignore`, and a basic `hello` program + test in the chosen language.

3) Branch / PR / commit conventions to follow here
- Create focused branches named `feature/<short-description>` or `copilot/<short>` for agent-created branches.
- Keep PRs small (1 logical change). In the PR description include the discovery checklist output.
- Use concise commit messages with a type prefix: `feat:`, `fix:`, `chore:` followed by a short summary.

4) Tests, CI and verification
- Add at least one fast, deterministic test runnable locally. For Node use `npm test` (with a minimal package.json); for Python use `pytest`.
- If adding CI, create `.github/workflows/ci.yml` with a simple matrix that runs lint and tests on push/PR.

5) Project-specific notes found in the workspace
- The only discovered entry is `BabblinGo/.DS_Store`. Do not commit OS-specific files; add a `.gitignore` that includes `.DS_Store`.

6) Style and code guidance specific to this repo
- Prefer minimal, idiomatic project layouts for the chosen language (one package/module, README, tests, simple CI). When in doubt, ask the repo owner which stack to bootstrap.
- Include a short usage example in `README.md` and a `Makefile` or `scripts/` for common commands if the project grows.

7) When merging into existing content
- If `.github/copilot-instructions.md` already exists, keep any human-written guidance and append only missing discovery steps, exact file references, or corrected commands.

8) Questions to ask the human owner (put in the PR description if unanswered)
- What language/runtime should this project use? (Node/Python/Go/Rust/etc.)
- Any preferred testing framework, CI provider settings, or coding styles/linters to apply?
- Is there an expected directory layout or prior art we should follow?

If any of the above is unclear, add a short interactive note in the PR asking the maintainer and stop before making risky assumptions.

---
Please review these instructions and tell me which language or initial task you'd like me to implement (README + scaffold, or initialize a particular stack). I'll update this file with any additional repository-specific patterns after you confirm or after I discover more files.
