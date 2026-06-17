# TODO System — Diaster Wholesale ERP

## How It Works

Tasks live as individual markdown files inside `active/`. A scheduled cloud agent runs daily, picks up the highest-priority active todo, implements it, verifies it, and then moves the file into `completed/` before pushing to `main`.

---

## Directory Layout

```
TODO/
  active/          ← tasks waiting to be done
    todo-001.md
    todo-002.md
  completed/       ← tasks that are done and pushed
    todo-001.md
  README.md        ← this file
  template.md      ← copy this when creating a new task
```

---

## Creating a New Todo

1. Copy `template.md` into `active/` and name it `todo-NNN.md` (next sequential number).
2. Fill in the frontmatter: `title`, `priority`, `created`, and any context.
3. Write the **Overview** section — what needs to be done and why.
4. Write the **Completion Test** section — how the routine will verify the task is done.
5. Leave the **Implementation Guide** and **Implementation Steps** sections blank — the routine fills those automatically using Opus 4.8.
6. Commit and push the file so the routine picks it up.

---

## Priority Levels

| Priority | Meaning                         |
|----------|---------------------------------|
| 1        | Critical — do this first        |
| 2        | High — do next                  |
| 3        | Normal — standard queue         |
| 4        | Low — do when nothing else left |
| 5        | Someday — no urgency            |

When multiple active todos have the same priority, the routine picks the one with the earliest `created` date.

---

## Todo File Sections

| Section               | Who Fills It         | When                        |
|-----------------------|----------------------|-----------------------------|
| Frontmatter           | You                  | When you create the todo    |
| Overview              | You                  | When you create the todo    |
| Completion Test       | You                  | When you create the todo    |
| Implementation Guide  | Routine (Opus 4.8)   | Before implementation starts|
| Implementation Steps  | Routine (Opus 4.8)   | Before implementation starts|
| Files to Modify       | Routine (Opus 4.8)   | Before implementation starts|
| Completion Notes      | Routine (Sonnet 4.6) | After implementation        |

---

## Routine Workflow (Daily)

```
1. Scan TODO/active/ — list all .md files
2. Parse frontmatter — sort by priority, then by created date
3. Pick the top todo
4. Spawn Opus 4.8 → reads codebase + todo Overview → writes Implementation Guide, Steps, Files to Modify back into the file
5. Spawn Sonnet 4.6 → reads the full todo file → implements every step
6. Run the Completion Test described in the todo file
7. If test passes → fill Completion Notes → move file from active/ to completed/ → commit → push to main
8. If test fails → leave the file in active/, add failure notes under Completion Notes, stop for human review
```

---

## Status Field

The frontmatter `status` field tracks where the routine left off:

| Status          | Meaning                                           |
|-----------------|---------------------------------------------------|
| `active`        | Waiting to be picked up                           |
| `in-progress`   | Routine is currently working on this              |
| `needs-review`  | Completion test failed — needs a human to look at |
| `completed`     | Done, moved to completed/                         |

---

## Rules

- **Never edit a file whose status is `in-progress`** — the routine owns it.
- **Never delete from `completed/`** — it is the permanent audit trail.
- To cancel a task: change its status to `cancelled` and move it to `completed/` manually.
- To re-open a task: copy it back to `active/`, reset status to `active`, increment the id suffix (e.g. `todo-007b.md`).
