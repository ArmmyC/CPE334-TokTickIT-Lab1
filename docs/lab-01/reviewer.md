# Lab 1 Peer Review Record

## Student information

- Name: Kamolpop Vitayarat
- Student ID: 67070501002
- GitHub username: [@ArmmyC](https://github.com/ArmmyC)

## Peer reviewer

- Name: Sitthichai Phirompan
- Student ID: 67070501074
- GitHub username: [@Bank848](https://github.com/Bank848)

## Repository and workflow

- Repository: [ArmmyC/CPE334-TokTickIT-Lab1](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1)
- Integration branch: lab1-staging
- Review rule: every Pull Request requires peer review; Bank848 is the designated peer reviewer

## Pull Requests submitted

| Issue | Pull Request | Branch | Target | Reviewer | Status |
| --- | --- | --- | --- | --- | --- |
| 1. Project foundation | [PR #5](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/5) | feature/1-project-foundation | lab1-staging | Bank848 | Approved and merged into lab1-staging |
| 2. API health check | [PR #6](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/6) | feature/2-health-check | lab1-staging | Bank848 | Approved and merged into lab1-staging |
| 2. Health-check correction | [PR #10](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/10) | feature/2-health-check-fix | lab1-staging | Bank848 | Awaiting peer review |
| 3. Category seed | [PR #7](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/7) | feature/3-category-seed | lab1-staging | Bank848 | Approved and merged into lab1-staging |
| 4. Category list | [PR #8](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/8) | feature/4-category-list | lab1-staging | Bank848 | Approved and merged into lab1-staging |
| Final release | [PR #9](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/9) | lab1-staging | main | Bank848 | Approved for merge into main |

## Review evidence summary

### Bank848 reviewed this repository

- [PR #5](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/5): Bank848 noted that the open CORS policy was acceptable for this local lab but should be restricted later. We recorded it as a non-blocking scope note.
- [PR #6](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/6): Bank848 noted that a hung fetch has no timeout. We kept the change scoped to the labsheet health behavior and recorded the note as non-blocking.
- [PR #7](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/7): Bank848 approved the seed implementation and reported a staging merge conflict. We resolved the conflict by synchronizing the feature branch with the latest staging branch before merging.
- [PR #8](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/8): Bank848 approved the category endpoint and noted the same non-blocking timeout consideration for the category request.
- [PR #9](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/9): Bank848 approved the final release with no issues found.

### I reviewed Bank848's repository

- [Bank848/toktickit PR #5](https://github.com/Bank848/toktickit/pull/5): I requested the runtime Supertest dependency, a server smoke test under `server/tests/lab-01/`, and README scope corrections. Bank848 responded in commit `21ce25a`; I re-reviewed the fixes and approved the PR.
- [Bank848/toktickit PR #6](https://github.com/Bank848/toktickit/pull/6): I reviewed the health endpoint, Supertest coverage, real frontend request, and loading/success/error states, then approved the PR.

PR #10 is the corrective follow-up for the missing Check System button and will be updated to its final approval/merge status after peer review.
