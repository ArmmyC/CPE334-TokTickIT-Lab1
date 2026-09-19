# Lab 3 Peer Review Record

## Student information

- Name: Kamolpop Vitayarat
- Student ID: 67070501002
- GitHub username: [@ArmmyC](https://github.com/ArmmyC)
- Repository: [ArmmyC/CPE334-TokTickIT-Lab1](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1)

## Peer reviewer

- Name: Sitthichai Phirompan
- Student ID: 67070501074
- GitHub username: [@Bank848](https://github.com/Bank848)
- Review rule: Bank848 is the designated peer reviewer and performs each merge after approval.

## Project and workflow

- GitHub Project: [TokTickIT Individual Sprints](https://github.com/users/ArmmyC/projects/3)
- Default branch: `main`
- Lab 3 integration branch: `lab3-staging`
- Documentation branch: `docs/lab3-delivery`
- Release branch: `release/lab3-to-main`
- Project status order: `Backlog`, `Specified`, `Started`, `PR Review`, `Fixing`, `Done`
- Lab 3 uses the Lab 2 branch flow. Contract, cleanup, implementation, verification, documentation, and release work are separated into Issue-linked Pull Requests. Direct pushes to `lab3-staging` and `main` are not part of the workflow.

## Lab 3 Pull Requests

| Issue | Pull Request | Branch | Target | Reviewer | Result | Merge commit |
| --- | --- | --- | --- | --- | --- | --- |
| [#40 Contract](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/40) | [PR #41](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/41) | `feature/1-lab3-contract` | `lab3-staging` | Bank848 | Approved and merged | [360528d](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/360528d0ba95b44d45795f41bacb19071795f26d) |
| [#42 Repository cleanup](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/42) | [PR #43](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/43) | `chore/lab3-repository-cleanup` | `lab3-staging` | Bank848 | Approved and merged | [ae55967](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/ae55967f1c29c724c33a0fa2b1c3f022fd2cc077) |
| [#44 Authentication Foundation](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/44) | [PR #52](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/52) | `feature/2-lab3-auth-foundation` | `lab3-staging` | Bank848 | Approved and merged | [26e8dad](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/26e8dade797cb803f90babe5e7973ca90ce1d2bc) |
| [#45 Authorization and Requester Regression](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/45) | [PR #53](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/53) | `feature/3-lab3-requester-regression` | `lab3-staging` | Bank848 | Approved and merged | [59918e6](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/59918e6366ecb51d9b8fdfeba7b053ca34659e67) |
| [#46 IT Staff Ticket Queue](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/46) | [PR #54](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/54) | `feature/4-lab3-staff-queue` | `lab3-staging` | Bank848 | Approved and merged | [fb4ddf6](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/fb4ddf604c8b0573f464e61f90cd0e3f69d490ea) |
| [#47 IT Staff Ticket Operations](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/47) | [PR #55](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/55) | `feature/5-lab3-staff-ticket-operations` | `lab3-staging` | Bank848 | Approved and merged | [8d83a9f](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/8d83a9f0e68a22838502188760174603f88fdbb9) |
| [#48 Administrator User Management](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/48) | [PR #56](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/56) | `feature/6-lab3-admin-users` | `lab3-staging` | Bank848 | Approved and merged | [820d9bb](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/820d9bb671c9e3bcf23b1c6d9186fce8164cb710) |
| [#49 E2E, Responsive, and Visual Verification](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/49) | [PR #57](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/57) | `feature/7-lab3-e2e-visual` | `lab3-staging` | Bank848 | Approved and merged | [c3fccc3](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/c3fccc3de62a45eaecdba17d33f6f32213b7c33a) |
| [#50 Documentation and Evidence](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/50) | [PR #58](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/58) | `docs/lab3-delivery` | `lab3-staging` | Bank848 | Open, review requested | To be recorded after review and merge |
| [#51 Staging-to-main Release](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/issues/51) | To be recorded after opening | `release/lab3-to-main` | `main` | Bank848 | Pending documentation merge | To be recorded after review and merge |

At this document version, Issue #49 is closed and its Project card is `Done`. Issue #50 is linked to open PR #58 and is awaiting Bank848’s review. Issue #51 remains in `Backlog` until the documentation PR is approved and merged. The pending rows are deliberately not presented as completed review evidence.

## Review comments and author responses

- [PR #41 contract review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/41#pullrequestreview-5165471077): Bank848 identified an AC-09 traceability mismatch because the Requester Public Comment and Problem Appears Resolved behavior was mapped to the Staff E2E flow. I replied with [commit `5da34eb`](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/5da34eb) adding `e2e/lab-03/requester-ticket-flow.spec.ts`, moved AC-09 to E2E-04, and asked for re-review. Bank848 confirmed the correction in [this comment](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/41#issuecomment-5630551225), and the PR was approved and merged.
- [PR #43 cleanup review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/43#pullrequestreview-5164168365): Bank848 approved the repository-artifact cleanup with “All looking good you can merge.” I replied, “Thank you, please merge for me!” in [the PR conversation](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/43#issuecomment-5615007023). The PR was merged into `lab3-staging`.
- [PR #52 authentication review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/52#pullrequestreview-5192136617): Bank848 asked whether `/api/auth/me` refreshed the sliding inactivity timeout. I fixed it in [commit `d6a54a5`](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/d6a54a5), added the regression coverage, reported the passing focused suites, and recorded the Docker-only migration limitation at that time. Bank848 confirmed the fix in [the follow-up comment](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/52#issuecomment-5666866483), approved, and merged the PR.
- [PR #53 authorization review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/53#pullrequestreview-5212389570): Bank848 noted that the client password rule did not count a hyphen as the required symbol and also noted intentional guard duplication around direct Change Password access. I fixed the hyphen policy in [commit `778e187`](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/778e187), added regression coverage, and explained why the direct-access guard remained unchanged. The PR was approved and merged.
- [PR #54 Staff Queue review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/54#discussion_r4023754307): Bank848 found that the queue detail links targeted a route that was not registered and would redirect a logged-in Staff user to Login. I fixed it in [commit `ba53f3e`](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/commit/ba53f3e) by adding the authenticated handoff route and a regression test. Bank848 confirmed the route fix in [the follow-up review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/54#pullrequestreview-5224512586), approved, and merged the PR.
- [PR #55 Staff operations review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/55#pullrequestreview-5233450999): Bank848 approved with “All LGTM.” Before merge, I recorded the status-dialog focus restoration and active-operation busy-state fixes, their regression tests, and passing client, server, and build checks in [the PR response](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/55#issuecomment-5713083729). The PR was merged.
- [PR #56 Administrator review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/56#pullrequestreview-5240472292): Bank848 approved the Administrator API and UI, then raised two non-blocking nits about sharing password-rule text and explicit `request.auth` checks. I replied to both threads with the verified server-authority and middleware reasoning, and left the approved code unchanged because neither was a correctness issue within Issue #48. The PR was merged.
- [PR #57 E2E review](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/57#pullrequestreview-5250497692): Bank848 approved the full authentication, Requester, Staff, Administrator, responsive, screenshot, and overflow evidence. I replied with [a merge-ready acknowledgement](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/57#issuecomment-5734881276), and Bank848 merged the PR as `c3fccc3`.

## Review rule audit

- Bank848 is the reviewer and merger recorded for the completed Lab 3 Pull Requests #41, #43, and #52 through #57.
- Every completed PR listed above targets `lab3-staging`, except the future release PR, which must target `main`.
- Review comments received on completed PRs have a corresponding author response in the linked PR conversation or inline thread.
- The current Project board has completed implementation and verification cards in `Done`. Issue #49 was closed after PR #57 merged. Issue #50 is linked to PR #58 and remains open until the documentation merge. Issue #51 remains open until the release gate is complete.
- The final-main approval, merge, verification, and Answer Sheet evidence are intentionally not claimed until the required release PR is merged.
