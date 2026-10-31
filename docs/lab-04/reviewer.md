# Lab 4 Reviewer and PR Record

All listed PRs target `lab4-staging`. Review and merge timestamps below are UTC. The confirmed Lab 4 reviewer is [Bank848](https://github.com/Bank848). Each approval was an actual GitHub review decision, and Bank848 performed each merge.

| Issue | PR and branch | Approval and merge evidence |
| --- | --- | --- |
| #64, engineering contract | [PR #71](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/71), `feature/64-lab4-contract` | Bank848 approved after the final contract correction. Merged 2026-10-29 at 14:22 UTC as `8410a2a44021553d8dba816a48e019cfec9c2166`. All 10 inline review threads were answered and resolved. |
| #65, Actions Taken API | [PR #72](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/72), `feature/65-actions-taken-api` | Bank848 approved, raised a note based on a different contract, and then confirmed the local PR matches the merged #71 contract. Merged 2026-10-30 at 05:29 UTC as `baa5d42e0ed42610db2ad2e9665d0821901dd27c`. |
| #66, Ticket workflow | [PR #73](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/73), `feature/66-ticket-workflow` | Bank848 approved after checking the transaction lock, resolution gate, version rules, and ordered history. The author replied that concurrency and browser regression remained tracked. Merged 2026-10-30 at 07:42 UTC as `c3f88a5d580101478154fad1f7764c2d3094b4b3`. |
| #67, Actions Taken UI | [PR #74](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/74), `feature/67-actions-taken-ui` | Bank848 noted that a new idempotency key on every submit could duplicate a retry. The author fixed it on the same branch in `9aece87`, replied with the change and regression test, and Bank848 re-approved. Merged 2026-10-30 at 14:20 UTC as `2f4181ffbe461db486feb075bf1485d00c7f3353`. |
| #68, role dashboards | [PR #75](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/75), `feature/68-role-dashboards` | Bank848 approved after reviewing the API filters and dashboard behavior. The author replied to the observations about action-record counts versus Ticket drill-downs, shared `asOf` without snapshot isolation, duplicated timestamp validators, and the remaining accessibility/main verification. Merged 2026-10-31 at 05:02 UTC as `2858a6ce1d9ce0c2779dc0ffe21840a5d541b598`. |

## Actual review comments and author responses

### PR #71

Bank848's review said: “Three things need an answer before implementation starts: the approval state, the follow-up gate deadlock, and what happens on Cancelled Tickets. The rest are nits.” The author updated the contract to record student approval, added `followUpCompleted` while preserving the required flag and note, defined terminal Ticket locks, and replied to the remaining version, retry, migration-trigger, and accessibility comments. Bank848 confirmed the follow-up, terminal-lock, trigger, and manual-audit decisions. A later comment asked to remove “proposed” from FR-07. The author removed it in commit `ce083a4`; Bank848 approved again after that correction. See the [review discussion](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/71).

### PR #72

Bank848's initial review referred to a `down.sql` and `If-Match` requirement from a different contract. The author replied: “I checked this against the approved Lab 4 contract merged in PR #71,” and explained the approved `expectedVersion` and backup/forward-fix recovery behavior. Bank848 replied: “You are right: I compared the PR against the contract in my own fork (its #52), not the contract merged in this repo's #71,” then approved again. The author asked Bank848 to merge after confirming the clarification. See the [review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/72#pullrequestreview-5702254504), [author response](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/72#issuecomment-6504458219), and [re-approval](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/72#pullrequestreview-5707491234).

### PR #73

Bank848's review checked the Ticket lock and version comparison, the resolution gate for Resolved and Closed, version increments from Owner/Priority/Requester indication writes, and chronological history. Bank848 noted that PostgreSQL concurrency and browser E2E still needed a clean pass before `main`. The author replied that both remained unverified and tracked, then asked Bank848 to merge. See the [review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/73#pullrequestreview-5709271685) and [author response](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/73#issuecomment-6517545146).

### PR #74

Bank848's review identified that creating `crypto.randomUUID()` during every submit could make a retry use a new idempotency key. The author replied: “Fixed in commit `9aece87` on the existing branch,” and described key reuse plus the lost-response regression test. Bank848 re-approved after checking the same-key retry test, and the author asked Bank848 to merge. See the [review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/74#pullrequestreview-5710510837), [author response](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/74#issuecomment-6520295779), and [re-approval](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/74#pullrequestreview-5711855988).

### PR #75

Bank848 approved after checking role-gated dashboard endpoints, Requester ownership scope, matching metric and drill-down windows, session-derived `ME` filters, strict date validation, and zero-valued status/priority counts. The review also noted the difference between an action-record count and a Ticket-list drill-down, the shared `asOf` value without one transaction snapshot, duplicate timestamp validators, and remaining accessibility/main verification. The author replied with those findings and kept hardening and final-main verification in Issue #69. See the [review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/75#pullrequestreview-5720599308) and [author response](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/75#issuecomment-6539325871).
