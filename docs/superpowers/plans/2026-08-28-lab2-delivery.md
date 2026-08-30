# Lab 2 Documentation and Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Issue #20 with evidence-backed Lab 2 documentation, review records, AI-use reflection, README and ignore-file guidance, and hand off one A4 portrait Answer Sheet for submission outside the repository.

**Architecture:** Start from the merged `origin/lab2-staging` commit `af94ee0` on the exact `docs/lab2-delivery` branch. Record only real GitHub workflow events and repository outputs, keep the required repository evidence in Git, and prepare the individual Answer Sheet outside the repository after final-main verification.

**Tech Stack:** Markdown, Git, GitHub Project and Pull Requests, Node.js npm workspaces, PostgreSQL, Prisma, Vitest, and Playwright. The Answer Sheet is prepared outside the repository.

**Spec:** `docs/lab-02/specification.md`, `docs/lab-02/tests.md`, `docs/lab-02/ui-spec.md`, `docs/lab-02/api-spec.md`, `Instruction/Instruction.md`, `Instruction/CPE334_Codex_Lab_Workflow_Instructions.md`, and `Lab 2/Lab_02_labsheet.pdf`.

## Global Constraints

- Work only on `docs/lab2-delivery`, based on the reviewed `origin/lab2-staging` merge commit `af94ee0`.
- The documentation PR targets `lab2-staging`, is linked to Issue #20, and is reviewed and merged by Bank848.
- The release PR is the single `lab2-staging` to `main` PR required by the Lab 2 sheet, and Bank848 must approve and merge it.
- Do not claim a review, approval, merge, test, screenshot, or final-main state until it is visible or reproducible.
- Use the exact Answer Sheet headings `Answer Part 1` through `Answer Part 9` in order when preparing the external submission.
- Use ASCII hyphens in new documentation and generated PDF text.
- Do not add authentication, IT Staff controls, comments, Actions Taken, or post-creation status transitions.

---

### Task 1: Evidence inventory and documentation baseline

**Files:**
- Read: `Instruction/Instruction.md`, `Instruction/CPE334_Codex_Lab_Workflow_Instructions.md`, `Lab 2/Lab_02_labsheet.pdf`
- Read: `docs/lab-02/specification.md`, `docs/lab-02/api-spec.md`, `docs/lab-02/ui-spec.md`, `docs/lab-02/tests.md`, `README.md`, `.gitignore`
- Create: `docs/superpowers/plans/2026-08-28-lab2-delivery.md`

- [x] Confirm the branch is `docs/lab2-delivery` and `HEAD` equals `origin/lab2-staging` at `af94ee0`.
- [x] Inventory the real Lab 2 PR links, Issue links, branch names, merge commits, reviewer decisions, comments, replies, and timestamps from PRs #21 through #27.
- [x] Inventory the real peer-review record on `Bank848/toktickit` PR #14, including the submitted review, Bank848's responses, correction commits, and merge state.
- [x] List every evidence item required by Lab 2 Section 14, including the final Project board, main history, documentation, tests, screenshots, and application states.
- [x] Record unresolved evidence dependencies as explicit work items, not as invented facts.

### Task 2: Final reviewer record

**Files:**
- Create: `docs/lab-02/reviewer.md`

- [x] Write the student and reviewer identities using the repository's real profile links and Bank848 as the sole Lab 2 reviewer.
- [x] Add a table for Issues #13 through #20 with exact Issue URLs, PR URLs where available, required branch, target branch, reviewer, and verified state.
- [x] Record PR #21 through #27 as reviewed and merged only with the actual GitHub merge commits and visible approval events.
- [x] Summarize each real Bank848 comment and the matching author reply, including the PR #21 contract questions and the PR #27 no-blocking-issues approval.
- [x] Add a peer-review section for `Bank848/toktickit` PR #14 using only the visible review thread, the contract corrections requested, Bank848's technical replies, and the final merge event.
- [x] Include direct links for every cited Issue, PR, commit, review, and comment anchor that is actually available.
- [x] Review the document for fabricated history, unresolved claims presented as facts, em dashes, and semicolon separators.

### Task 3: AI-use record and reflection

**Files:**
- Create: `docs/lab-02/ai-use.md`

- [x] State that OpenAI Codex GPT-5 was used as the coding assistant and that the student reviewed requirements, code, tests, commands, visual output, and GitHub workflow state.
- [x] Add a table with 6 to 10 genuine prompts from this working conversation, each with the stage, exact or clearly marked excerpt, resulting check or change, and a short reflection.
- [x] Include prompts covering labsheet interpretation, contract planning, implementation, review skepticism, test-database safety, E2E and visual verification, and evidence preparation.
- [x] Write a brief `My Reflection` that explains how specification-first prompts, failing tests, reviewer feedback, and visual inspection changed decisions.
- [x] Do not claim AI actions, prompts, or evidence that are not present in the conversation or repository history.

### Task 4: README and ignore-file audit

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`

- [x] Document Lab 2 setup, the development database, the dedicated test database on port 5434, guarded preparation, migrations, seed, unit and API tests, build, E2E, and the three required viewport sizes.
- [x] Document the temporary requester selector as testing context, not authentication, and list the requester-facing routes and attachment storage behavior.
- [x] Keep `.env.test` and local attachment bytes ignored while retaining `.env.test.example` as a tracked template.
- [x] Keep Playwright reports, test results, build output, coverage, and local storage ignored.
- [x] Check all links and commands against the current package scripts and repository paths.

### Task 5: External Answer Sheet preparation

**Files:**
- No repository files. The Answer Sheet and its rendering intermediates remain outside Git.

- [x] Prepare one concise A4 portrait Answer Sheet with the exact headings `Answer Part 1` through `Answer Part 9`.
- [x] Use only real repository links, review evidence, test output, screenshots, and captions.
- [x] Keep the Answer Sheet, PDF, and rendering intermediates outside the repository and submit them on the course platform.

### Task 6: Documentation verification and PR handoff

**Files:** existing repository documentation and evidence

- [ ] Run `npm run db:test:up`, `npm run test:db:prepare`, `npm test`, `npm run build`, `npm run test:e2e`, and `git diff --check` from the docs branch.
- [ ] Confirm `.env.test`, local storage bytes, Playwright output, and temporary PDF renders are not tracked.
- [ ] Commit the docs-only changes with an explanatory message and push only `docs/lab2-delivery`.
- [ ] Open a PR to `lab2-staging`, link it to Issue #20 through Development, request Bank848, and move Issue #20 to `PR Review`.
- [ ] Reply to every review comment before any correction or merge. If changes are requested, move `PR Review` to `Fixing`, correct the same branch, rerun affected checks, push, reply, and return to `PR Review`.
- [ ] Leave the documentation merge to Bank848, then move Issue #20 to `Done` and close it after the actual merge.

### Task 7: Release integration and external Answer Sheet

**Files:** final-main evidence and external submission output

- [ ] After Issues #13 through #20 are Done, verify the final Project board and staging branch, then open exactly one release PR from `lab2-staging` to `main`.
- [ ] Link and request Bank848 on the release PR, reply to every review comment, and leave approval and merge to Bank848.
- [ ] After the actual release merge, switch to `main`, pull the merge, rerun migrations, seed verification, all tests, build, E2E, and live database checks.
- [ ] Capture final-main Git history, Project board, release approval and merge, and the final verification output.
- [ ] Prepare and inspect the external Answer Sheet with all nine headings, readable screenshots, captions, and working links.

## Self-Review Checklist

- [ ] Reviewer records contain only genuine GitHub comments, replies, approvals, and merges.
- [ ] AI-use records contain genuine prompts and a student reflection.
- [ ] README and `.gitignore` match the merged implementation.
- [ ] Every external Answer Sheet part follows the Lab 2 Section 14 checklist and uses real evidence.
- [ ] Exactly one A4 portrait Answer Sheet PDF is submitted on the course platform.
- [ ] The external Answer Sheet uses final-main evidence after the release merge.
- [ ] No required test is skipped, disabled, or reported without output.
- [ ] No Lab 3 or IT Staff feature appears in the implementation or evidence.
- [ ] Issue #20 follows `Backlog -> Specified -> Started -> PR Review -> Done` and is closed after its merge.
