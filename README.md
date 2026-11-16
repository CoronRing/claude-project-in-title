# Project in Title

A Claude Code plugin that puts the project in every session title, with a colour per project:

```
🟣 my-app · Fix login redirect
🟢 docs · Rewrite install guide
🟣 my-app · Add rate limiting
🔵 infra · Bump Terraform providers
```

When the session list is sorted by date, sessions from different projects are mixed together and the project is lost. Grouping by project brings it back, but then switching between projects means scrolling past whole groups. This plugin keeps the flat, recent-first list and adds the project to each title, so you can see it at a glance.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install project-in-title --marketplace CoronRing/claude-project-in-title
```

Or from a shell:

```bash
claude plugin install project-in-title --marketplace CoronRing/claude-project-in-title
```

Answer `y` to add the marketplace, then pick the **user** scope so it applies to every project. The plugin is used by new sessions in the terminal, VS Code and the desktop app.

## How it works

| Where | When the tag is added | How |
| --- | --- | --- |
| Desktop app (Code tab) | At the end of the session's first turn, once the app has named the session | Renames the session through the app's own session tools |
| Terminal (CLI) | On the message after Claude Code has named the session, usually the second | Returns the tagged title from the `UserPromptSubmit` hook |
| VS Code | Same as the terminal | Same as the terminal |
| Resumed sessions | When you resume them | The `SessionStart` hook tags the existing title |

The project is the name of the session's folder. A session in a git worktree (under `.claude/worktrees/` or `.worktrees/`) uses the repository's folder name instead, so a worktree session is tagged with its project rather than the worktree.

The plugin only adds the tag. The session name itself still comes from Claude Code. If you rename a session and drop the tag, it is added back on the next turn.

## Colours

Each project gets a colour picked from its name, so the same project always has the same colour on every surface. Nine colours are available: purple, blue, green, yellow, orange, red, brown, black and white. With more than nine projects some will share a colour, so pick colours for the projects you use most.

To choose colours, set the **Project colours** option in `/config`, or in `settings.json`:

```json
{
  "pluginConfigs": {
    "project-in-title@claude-project-in-title": {
      "options": { "colors": "my-app=purple, docs=green, infra=blue" }
    }
  }
}
```

Project names are matched without regard to case.

## Requirements

- A Claude Code version with plugin hooks modules (tested on 2.1.321). The desktop part uses this early-access API, which may change between releases.
- A POSIX shell for the terminal and VS Code part. On Windows, that is Git Bash, which Claude Code uses for hooks when it is installed.
- In the desktop app, a permission mode that allows the session tools. In bypass mode the rename never asks; in stricter modes the app may ask before renaming.

## Development

| Path | What it is |
| --- | --- |
| `hooks/register.ts` | Hooks module for the desktop app: renames the session at the end of each turn |
| `hooks/title.sh` | Command hook for the terminal and VS Code |
| `hooks/register.test.ts` | Tests for the hooks module: `claude plugin test .` |
| `tests/title.test.sh` | Tests for the command hook: `sh tests/title.test.sh` |

The colour palette, the colour hash and the tag format are written in both `register.ts` and `title.sh`. Change them together; the tests in both files check the same colour picks.

To try a local copy, start Claude Code with `claude --plugin-dir <this folder>`. Run `claude plugin validate .` before a release.

## License

MIT
