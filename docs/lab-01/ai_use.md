# Lab 1 AI Use and Reflection

I used OpenAI Codex (GPT-5) as an AI coding assistant. I reviewed the generated requirements, files, commands, tests, and GitHub changes before accepting them. I remained responsible for understanding the labsheet and the final repository.

## Selected key prompts

The prompts below are concise representative reconstructions of the main prompts used during the work.

| Stage | Prompt used | Reflection |
| --- | --- | --- |
| Understand the labsheet | “Read Lab 1 and summarize the required stack, four Issues, branches, endpoints, tests, GitHub workflow, and final submission evidence. Do not write code yet.” | Starting with the contract made the implementation order clear. |
| Plan GitHub workflow | “Give me a step-by-step plan for main, lab1-staging, the Project board, four Issues, feature branches, peer-reviewed PRs, and the final staging-to-main release.” | This exposed the required Issue dependency order and review checkpoints. |
| Set up the foundation | “Implement only Issue 1 with React, TypeScript, Vite, Bootstrap, Express, Prisma, PostgreSQL configuration, Vitest, Supertest, documentation, and safe environment-file handling.” | Explicit scope kept the foundation PR focused. |
| Implement the health flow | “Implement Issue 2 with GET /api/health, the exact JSON response, a Supertest test, and a real frontend health request with loading, online, and useful offline states.” | Keeping the API contract and UI behavior together made review easier. |
| Implement categories | “Implement the Category model, migration, idempotent seed, GET /api/categories, predictable ordering, Supertest coverage, and API-backed category UI without hard-coded names.” | Separating seed and list work followed the labsheet dependency graph. |
| Verify each increment | “Compare the branch with its Issue and the labsheet, then run npm test, npm run build, git diff --check, and the relevant live database checks.” | This caught missing setup details and kept the evidence reproducible. |
| Correct the final UI | “Audit the completed app against the stakeholder result and Part 4. Add a visible Check System button that triggers both API requests, keep it visible after success/failure, use the required app heading, and update the UI test.” | The audit found a real gap that the first automated tests had not covered. |
| Prepare submission evidence | “Review the full Section 14 checklist and organize concise Answer Parts 1–4 with GitHub workflow, tests, AI reflection, review evidence, and success/failure app screenshots.” | A final evidence review helped avoid missing the PDF-only submission format. |

## Reflection

The most useful prompts were specific about scope, acceptance criteria, branch targets, and what must not be implemented yet. The final audit was especially important: the original UI tests passed even though the required Check System button was missing. Adding a requirement-focused UI test showed me that green tests are not enough unless they verify the stakeholder behavior directly.
