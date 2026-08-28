# Lab 2 AI Use and Reflection

## Tool and responsibility

I used OpenAI Codex GPT-5 as an AI coding assistant. I remained responsible for reading the Lab 2 sheet and workflow instructions, choosing the implementation boundaries, reviewing every generated change, running the commands, checking the database, inspecting screenshots, and deciding whether the GitHub evidence was real and complete.

The prompts below are selected excerpts from the working conversation. They are recorded as prompts that were actually entered, not generated examples. Long prompts are identified by their opening text so the full original request remains in the conversation history.

## Selected prompts

| Stage | Prompt entered | What I checked or changed | Reflection |
| --- | --- | --- | --- |
| Contract discovery | “Okay so read [CPE334_Codex_Lab_Workflow_Instructions.md] and Read [Lab 2] and plan what to do follow the instruction” | Read the complete workflow files and Lab 2 sheet, then recorded the Issue order, branch names, reviewer rule, test scope, and PDF format. | Starting with the current sources prevented Lab 1 examples from being silently reused for Lab 2. |
| Specification-first implementation | “PLEASE IMPLEMENT THIS PLAN: # TokTickIT Lab 2 Execution Plan” | Executed the sequential contract, data model, requester, ticket, list, detail, E2E, and delivery increments through reviewed branches. | The plan made each PR small enough to verify against one Issue and one acceptance boundary. |
| Review discipline | “Read new bank's reviews for our second pr” | Opened the real review page, extracted the comments, checked them against the code and contract, and replied with technical evidence. | Review comments were treated as claims to verify, not instructions to accept blindly. |
| Source verification | “Check [Instruction.md] and Read [Lab_02_labsheet.pdf] again, I think every time we need to respond first” | Re-read the workflow and submission sections, including the exact Zen Green tokens, seed minimums, status flow, and reply requirement. | Rechecking the source corrected uncertainty about what was mandatory and kept the workflow evidence honest. |
| Safety and infrastructure | “do it, don't forget to check [Instruction.md] and [Lab_02_labsheet.pdf] to make sure agai” | Added the exact `/toktickit_test` guard, dedicated PostgreSQL service, idempotent seed checks, and documented setup. | A destructive database command needs a tested safety boundary, not only a README warning. |
| E2E and visual audit | “do it for me [@Chrome](plugin://chrome@openai-bundled)” | Used the authenticated browser to verify GitHub workflow state and the local application, captured real desktop, tablet, and mobile screenshots, and found a disabled-button color regression. | Browser evidence and native-size image inspection caught a presentation issue that functional tests alone did not show. |
| Review response | “respond to it” | Posted a short, factual reply to Bank848 on PR #27 after checking that the review was an approval with no blocking issues. | The Lab 2 workflow requires a review conversation, so approval was not left unanswered. |
| Delivery checkpoint | “Bank has merged” followed by “do it” | Verified Bank848 merged PR #27, moved Issue #19 to Done and closed it, then created the required `docs/lab2-delivery` branch and started Issue #20. | The next Issue was not started until the reviewer merge was visible, matching the dependency gate. |

## My Reflection

The most useful prompts were the ones that named the source files, branch target, acceptance criteria, and exclusions. I learned to ask for a failing test before implementation, then to verify the result with the real database, build, E2E run, and screenshots. Bank848's questions also improved the work, especially the test-database guard and the explicit partial-upload behavior. The final visual inspection found a disabled primary control that had fallen back to Bootstrap blue, so I added a focused CSS regression test and corrected the token. The assistant accelerated drafting and checking, but the specification decisions, evidence review, and GitHub workflow decisions remained mine.
