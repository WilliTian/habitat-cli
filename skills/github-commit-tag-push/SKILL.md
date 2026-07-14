---
name: github-commit-tag-push
description: Use when the user wants to stage changes, create a Git commit with a specified message, create or update a tag, push the branch and tag to GitHub, and report the public repository URL.
---

# GitHub Commit Tag Push

Use this skill when the user explicitly wants a repo state published to GitHub with a chosen commit message and tag.

## Workflow

1. Inspect the repo state before changing git metadata:
   - `git status --short --ignored`
   - `git remote -v`
   - `git branch --show-current`
   - `git tag --list <requested-tag>`
2. Stage intended project changes with `git add -A`, but do not force ignored runtime files like `.env`, `.habitat/`, `node_modules/`, or other secrets/caches into the index unless the user explicitly asks.
3. Create the commit with the exact user-provided message:
   - `git commit -m "<message>"`
   - If there is nothing to commit, check whether the requested commit already exists from an interrupted run before doing anything else.
4. Create the requested tag on the target commit:
   - `git tag <tag> HEAD`
   - If the tag already exists and points at the intended commit, reuse it.
   - If the tag exists on the wrong commit, stop and explain the conflict unless the user explicitly asks to move it.
5. Push the current branch:
   - `git push origin <current-branch>`
6. Push the tag:
   - `git push origin <tag>`
7. Report the public submit URL:
   - Prefer `https://github.com/<owner>/<repo>/tree/<tag>` when the tag is the required submission target.

## Required Checks

- Run the relevant tests and typecheck before commit if the work changed code.
- Re-read `git status --short` after commit and push so the report reflects the real repo state.
- If git writes fail in the sandbox because `.git` is read-only, request escalation for the exact git command.

## Output

Report:

- commit sha and message
- pushed branch name
- pushed tag name
- public GitHub URL to submit

## Common Traps

- Do not assume ignored files should be committed.
- Do not overwrite an existing tag silently.
- Do not push a different branch than the current working branch unless the user asks.
- Do not claim success without verifying both branch push and tag push output.
