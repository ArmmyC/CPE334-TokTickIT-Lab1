# Lab 3 AI Use and Reflection

## Tool and responsibility

I used OpenAI Codex GPT-5 as an AI coding assistant. I remained responsible for reading the Lab 3 sheet and workflow instructions, choosing the Issue and branch boundaries, reviewing every generated change, running the commands, inspecting screenshots and GitHub records, and deciding whether the evidence was real and complete. The Answer Sheet, final PDF, and temporary extracts remain outside the repository.

## Selected genuine prompts

The prompts below are selected from the working conversation. They are recorded as prompts that were actually entered, not generated examples.

| Stage | Prompt entered | Checking and refinement |
| --- | --- | --- |
| Source capture | “Read [CPE334_Codex_Lab_Workflow_Instructions.md] and [Lab_3_sheet.pdf] and plan next step” | The workflow and the complete Lab 3 PDF were read before implementation. The Issue order, branch flow, Bank848 review rule, required documents, test layers, and final PDF boundary were recorded. |
| Repository cleanup planning | “what I want is I want another pr before feature/1-lab3-contract ... plan first” | The cleanup was kept as its own reviewed PR, then the Lab 3 contract PR started from the cleaned repository state. |
| Issue planning | “Write the issues order somewhere as markdown file so we can keep it as reference for future but dont commit it” | The Issue order was kept as an external reference, while only the Lab 3 documents required by the sheet were committed. |
| Scope checking | “check the pr with [Lab_3_sheet.pdf](<Lab 3/Instruction/Lab_3_sheet.pdf>)” | Pull Request scope, required paths, screenshots, and traceability were compared with the PDF instead of relying on a generic code review. |
| Review correction | “fix Main findings: you found earlier on PR41 so just commit it into that pr right?” | The AC-09 mapping was corrected in `docs/lab-03/tests.md`, a dedicated Requester E2E flow was added, and the actual Bank848 review and response were recorded. |
| Verification retry | “try full test again” | The complete unit, API, migration, build, and Playwright matrix was rerun after the E2E fixes. The final matrix passed 21 of 21 tests across all three required viewports. |
| Responsive diagnosis | “how to make it reacable” | The responsive behavior was checked at the exact desktop, tablet, and mobile sizes from the sheet. Screenshot evidence and `scrollWidth <= innerWidth` assertions were used to refine the result. |
| Release planning | “before we go, check the current stage with the labsheet again” | The current staging state was compared with the release and final-main requirements before starting documentation and release work. |

## Checking and refinement process

- Read the current Lab 3 sheet and reusable workflow before each phase change.
- Compared each Issue branch and changed-file list with the Issue scope and required repository paths.
- Used the real GitHub PR, review, comment, approval, merge, Issue, and Project records for `reviewer.md` rather than inferring review evidence from local commits.
- Treated Bank848 findings as technical claims to verify. The `/api/auth/me` timeout, hyphen password rule, Staff detail route, focus handling, busy-state behavior, pagination assertion, persisted Staff mutations, and Administrator activation flow were checked in code and tests.
- Re-ran the complete staging-equivalent verification after PR #57 merged. The guarded test database prepared successfully, migration passed, all 216 unit and API or UI tests passed, the build passed, and all 21 Playwright tests passed.
- Kept seeded passwords, `.env`, `.env.test`, Answer Sheet files, final PDF files, plans, and temporary extracts outside Git.

## Reflection

The most useful prompts named the source of truth, Issue boundary, branch target, reviewer rule, and excluded artifacts. Starting from the Lab 3 sheet prevented the documentation step from being treated as an informal README update. The review-driven checks were also important. Bank848’s comments exposed real mismatches that ordinary green tests did not guarantee, especially the missing Staff detail route and the Requester traceability mapping. The assistant accelerated search, drafting, test execution, and evidence collection, but the specification decisions, scope choices, review responses, and final evidence decisions remained mine.
