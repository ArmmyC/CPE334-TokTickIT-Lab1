# Lab 2 Peer Review Record

## Student information

- Name: Kamolpop Vitayarat
- Student ID: 67070501002
- GitHub username: [@ArmmyC](https://github.com/ArmmyC)
- Repository: [ArmmyC/CPE334-TokTickIT-Lab1](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1)

## Peer reviewer

- Name: Sitthichai Phirompan
- Student ID: 67070501074
- GitHub username: [@Bank848](https://github.com/Bank848)
- Lab 2 reviewer rule: Bank848 is the sole peer reviewer and performs each merge after approval.

## Project and workflow

- GitHub Project: [TokTickIT Individual Sprints](https://github.com/users/ArmmyC/projects/3)
- Default branch: `main`
- Lab 2 integration branch: `lab2-staging`
- Required status order: `Backlog`, `Specified`, `Started`, `PR Review`, `Fixing`, `Done`
- Every implementation PR was opened from its Issue branch to `lab2-staging`, linked through the PR Development panel, reviewed by Bank848, and merged by Bank848.
- Issue #19 was moved to `Done` and closed after Bank848 merged PR #27. Issue #20 followed the same workflow on `docs/lab2-delivery`, then the staging branch was released to `main`.

## Lab 2 Pull Requests

| Issue | Pull Request | Branch | Target | Reviewer | Verified result | Merge commit |
| --- | --- | --- | --- | --- | --- | --- |
| [#13 Contract](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/13) | [PR #21](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/21) | `feature/1-lab2-contract` | `lab2-staging` | Bank848 | Approved and merged | [16d662f](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/16d662f704195f2fbc642640228daf79db55241c) |
| [#14 Data model](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/14) | [PR #22](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/22) | `feature/2-lab2-data-model` | `lab2-staging` | Bank848 | Approved and merged | [c7aec3b](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/c7aec3b2c23cb251008c923c90f2c37f2cc65c91) |
| [#15 Requester context](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/15) | [PR #23](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/23) | `feature/3-lab2-requester-context` | `lab2-staging` | Bank848 | Approved and merged | [c47ad92](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/c47ad92bf314f208e8a5d9eeb5671589ee7776ef) |
| [#16 Create Ticket](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/16) | [PR #24](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/24) | `feature/4-lab2-create-ticket` | `lab2-staging` | Bank848 | Approved and merged | [5493fca](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/5493fcaf5041f2141bfb420cac8133ce64ac2d09) |
| [#17 My Tickets](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/17) | [PR #25](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/25) | `feature/5-lab2-my-tickets` | `lab2-staging` | Bank848 | Approved and merged | [1238dd4](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/1238dd43dd100ab0b13b59881e2539b4eedfd369) |
| [#18 Detail and attachments](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/18) | [PR #26](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/26) | `feature/6-lab2-ticket-detail-attachments` | `lab2-staging` | Bank848 | Approved and merged | [6f7c3d3](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/6f7c3d3ce22dad9d0591b9b1ec14bee481c1d9e1) |
| [#19 E2E and visual](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/19) | [PR #27](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/27) | `feature/7-lab2-e2e-visual` | `lab2-staging` | Bank848 | Approved and merged | [af94ee0](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/af94ee00681fe562ad588900988aa822c8606741) |
| [#20 Documentation and delivery](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/20) | [PR #28](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/28) | `docs/lab2-delivery` | `lab2-staging` | Bank848 | Approved and merged | [c9a6140](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/c9a61408887e6a0ed6dcf9d3b200cc4c1f9b14d9) |
| Release | [PR #29](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/29) | `lab2-staging` | `main` | Bank848 | Approved and merged | [a897111](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/a8971114eaf38f3905da515cc242c944f46cc4e3) |

## Comments received on our Lab 2 PRs

The links below are the real PR conversations. The summaries preserve the technical meaning of the visible comments and the corresponding replies.

- [PR #21 contract review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/21): Bank848 marked the contract generally complete, then asked for BR-41 to state partial attachment failure behavior and for the test database guard to be an executable safety rule. I replied with commit [5edf25e](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/5edf25e87a01cebe5f79906e4bef917e81349e68), linked BR-41 to the UI success panel, and added BR-43 plus the guard test. Bank848 confirmed both points before approving.
- [PR #22 data model review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/22): Bank848 asked whether existing category names fit the new `VarChar(100)` bound and noted that the seed uses narrow hand-written upsert interfaces. I replied with the measured category lengths and the reason the testable interfaces were intentionally kept database-independent. Bank848 accepted the explanation and approved.
- [PR #23 requester context review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/23): Bank848 asked whether Change Requester should refetch the global requester reference list and noted the defensive shell guard. I explained that this increment clears the context while later ticket screens reload requester-scoped data, and kept the second guard to protect future route compositions. The PR was approved and merged.
- [PR #24 Create Ticket review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/24): Bank848 asked about the defensive 409 conflict response and the extra `ticketId` field in the attachment serializer. I documented that the UUID placeholder and persisted id make normal collisions unreachable, and that the extra non-sensitive field was harmless for this increment. The PR was approved and merged.
- [PR #25 My Tickets review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/25): Bank848 noted that search requests are sent on every keystroke without debounce. I recorded it as a future performance improvement outside the approved Lab 2 scope. The PR was approved and merged.
- [PR #26 Ticket Detail and attachment review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/26): Bank848 confirmed ownership checks, removed-file blocking, safe 404 behavior, storage-key privacy, and the removal-dialog focus trap, with no blocking issues. I replied that the review was recorded and no changes were requested. Bank848 approved and merged the PR.
- [PR #27 E2E and visual review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/27): Bank848 confirmed the guarded test database, real isolated E2E flow, attachment and ownership coverage, screenshots, and traceability documents, with no blocking issues. I replied, “Thanks for reviewing and confirming there are no blocking issues. Issue #19 remains in PR Review pending your merge.” Bank848 then merged commit [af94ee0](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/af94ee00681fe562ad588900988aa822c8606741).
- [PR #28 documentation and delivery review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/28): Bank848 approved the docs-only increment and recorded two non-blocking PDF-builder nits, the no-op part loop and the indirect `os.sys.stderr` reference. I replied to each thread before correcting the builder in commit [e3f6fa6](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/e3f6fa662ef2f08396527e4880de7f4115372087). The corrected PR was merged by Bank848 as [c9a6140](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/c9a61408887e6a0ed6dcf9d3b200cc4c1f9b14d9).
- [PR #29 release review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/29): Bank848 compared `main...lab2-staging`, confirmed that the eight commits matched PRs #21 through #28, and approved the release with no requested changes. I replied with the verification record before Bank848 merged [a897111](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/a8971114eaf38f3905da515cc242c944f46cc4e3) into `main`.

## Peer review performed on Bank848's repository

- Repository: [Bank848/toktickit](https://github.com/Bank848/toktickit)
- Reviewed change: [Bank848/toktickit PR #14](https://github.com/Bank848/toktickit/pull/14)
- Branch flow shown on the PR: `feature/5-lab2-specs` into `lab2-staging`, later merged by Jinnakan on 2026-08-25.
- I submitted review feedback on the specification set, including the required My Tickets search, visible Development Requester selector, Zen Green tokens, create-time attachment compensation, soft removal, complete acceptance-criterion traceability, and removal of out-of-scope comments and workflow features.
- Bank848 responded with correction commits and inline explanations. When the exact seed counts and Zen Green values were questioned, I checked the Lab 2 PDF directly and cited the relevant requirements. When the ownership status code rationale was inconsistent, I identified the leak, and Bank848 changed cross-owner Ticket Detail and attachment access to the same safe 404 used for missing resources while keeping the separate known-owner delete case distinct.
- The final PR page shows the review conversation, the correction history, the merged state, and the linked Issue #10. No claim is made here about a review decision that is not visible on the PR page.

## Review rule audit

- Bank848 submitted the approving review for PRs #21 through #29.
- Bank848 performed every Lab 2 feature merge into `lab2-staging` and the final release merge into `main`.
- Author replies are present in the review conversations, including the response on PR #27.
- Issue links are visible in each PR Development panel.
- Issues #13 through #20 are closed and have project status `Done`.
- The single release PR from `lab2-staging` to `main` is PR #29, approved and merged by Bank848.
