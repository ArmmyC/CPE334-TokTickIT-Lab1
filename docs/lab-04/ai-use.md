# Lab 4 AI Use Record

## Tool

OpenAI Codex, GPT-6, was used as a specification partner and implementation assistant for Lab 4. The student made the contract decisions, approved the specification before implementation, and directed the Issue and review workflow.

## Selected prompts from the actual conversation

1. “Use a specification-first handoff. Prepare and refine docs/lab-04/specification.md, tests.md, ui-spec.md, and api-spec.md before implementation. The student must review and approve the contract before coding begins.”
   - This kept implementation behind the reviewed contract and required each acceptance criterion to map to a planned test.

2. “Before freezing the contract, stop and ask me how to interpret this ambiguity: the sheet says Actions Taken may be created and updated and provides a view/edit mode, but Answer Part 7 asks for ‘append-only behavior’ without saying whether that applies to Actions Taken or Ticket workflow history.”
   - The exact sheet wording was checked before deciding that status history is append-only while Actions Taken can be edited in place.

3. “Can you give me the real wording in the labsheet that you are confused”
   - The discussion was grounded in the handout text rather than resolving the ambiguity from memory.

4. “can you explain more? and search the labsheet”
   - The follow-up gate discussion was checked against the actual Lab 4 sheet and contract.

5. “Add a separate completion field and gate on completion (Recommended)”
   - The approved decision keeps `followUpRequired` and its note unchanged while storing completion separately.

6. “Lock Resolved, Closed, and Cancelled (Recommended)”
   - This fixed the terminal-status write rule for Actions Taken and the corresponding API and UI tests.

7. “don't only change but also comment back too”
   - Review corrections were handled on the existing PR branch and paired with replies to the real review threads.

8. “bank has approved, let's respond back and let him merge”
   - The workflow waited for an actual approval, then asked Bank848 to perform the merge.

9. “maybe you can check labsheet4 and labsheet3”
   - Reviewer observations and regression requirements were checked against the current and prior lab sheets.

## How outputs were checked

Contract decisions were checked against the complete Lab 4 sheet and the Lab 3 behavior that must remain. API and UI changes were checked against the approved four-file contract, Issue acceptance criteria, and regression tests. New behavior followed a test-first cycle, with the test failure observed before the code change. GitHub reviews, comments, approvals, and merges were checked from their actual PR histories. Screenshots came from the running application and were inspected at the required viewport sizes.

## My Reflection, draft for student review

The specification-first handoff made the follow-up and history decisions explicit before implementation. Asking for the handout wording helped avoid guessing when the sheet and answer prompt seemed inconsistent. Peer review found contract details that needed clearer wording and an idempotency retry gap, so the author replied with the correction and kept the change on the same branch. The tests and screenshots then provided evidence for behavior across roles and screen sizes. The student should personalize this reflection before using it in the external Answer Sheet.
