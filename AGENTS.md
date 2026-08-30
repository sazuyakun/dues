# Worktrees

- Use only the assigned persistent worktree and its current branch.
- Before starting work, rename a generic worktree branch to a descriptive two- or three-word lowercase name such as `web-platform-shell`; use hyphens only and no namespace prefix.
- Never switch branches or work directly on `main`, unless the user explicitly requests integration from the main worktree.
- Before starting, inspect `git status` and preserve existing user or agent changes.

# Changes

- Keep each task focused; avoid unrelated edits and broad refactors.
- Never reset, discard, overwrite, or clean changes you did not create.
- Before handoff, run the smallest relevant tests or lint checks available for the changed files.
- Review the diff and commit completed work on the current worktree branch.
- Use a concise, descriptive commit message.
- Never integrate branches, push, force-push, or create a pull request unless the user explicitly requests it.

# Handoff

- Report the commit hash, tests run and their results, and any remaining concerns.

# Integration

- Treat the main worktree as the integration workspace.
- The instruction `update branch` explicitly authorizes fetching `origin` and merging the latest `origin/main` into the current worktree branch; do not push.
- The instruction `push to main` explicitly authorizes the complete integration workflow for the current worktree branch.
- On `push to main`, fetch `origin`, update local `main` from `origin/main`, merge `main` into the current worktree branch, merge that branch into `main`, and push only `main` to `origin`.
- Resolve merge conflicts when the correct resolution is clear; otherwise stop and report them without discarding or overwriting changes.
- Stop and report any unexpected commit or uncommitted change.
- After integration, continue new tasks in the same assigned worktree and branch.
