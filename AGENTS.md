# Worktrees

- Use only the assigned persistent worktree and its current branch: `codex/worktree-1`, `codex/worktree-2`, `codex/worktree-3`, or `codex/worktree-4`.
- Never switch branches or work directly on `main`.
- Before starting, inspect `git status` and preserve existing user or agent changes.

# Changes

- Keep each task focused; avoid unrelated edits and broad refactors.
- Never reset, discard, overwrite, or clean changes you did not create.
- Before handoff, run the smallest relevant tests or lint checks available for the changed files.
- Review the diff and commit completed work on the current worktree branch.
- Use a concise, descriptive commit message.
- Never merge, rebase, push, force-push, or create a pull request unless the user explicitly requests it.

# Handoff

- Report the commit hash, tests run and their results, and any remaining concerns.
- Treat the main worktree as the integration workspace. The user will rebase completed branches onto `main`, fast-forward merge them one at a time, and push only `main`.
