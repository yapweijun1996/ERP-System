# Studying Odoo (legally) for reference

**Yes, you can study Odoo — but how you do it matters legally.** Read this before cloning
anything.

## 1. The license facts

- **Odoo Community Edition is licensed under LGPLv3.**
  ([odoo/LICENSE](https://github.com/odoo/odoo/blob/19.0/LICENSE),
  [Odoo licenses](https://www.odoo.com/documentation/19.0/legal/licenses.html))
- **Odoo Enterprise Edition is proprietary.** Do **not** read it for porting, do not copy
  from it. Study **Community / LGPL only.**
- LGPLv3 is derived from the GPL: you may use, modify, and redistribute, **but derivative
  works carry the same license and source-disclosure obligations.**

## 1b. "The project is private" — what that does and does NOT change

LGPL/GPL obligations attach on **conveyance (distribution)**, not on private use. So:

- ✅ **Cloning Odoo locally to read, run, and study is fine** — even cleaner because it is
  private, non-distributed use. No LGPL trigger.
- ❌ But "private" **does not loosen the code boundary**, because this project has **two
  distribution exits**, and both are live:
  1. **Public demo → GitHub Pages.** Conveyed to the whole world, unconditionally.
  2. **Production ERP → delivered to the client.** Handing a self-hosted Docker stack to a
     client (which the [setup wizard](SETUP_WIZARD.md) implies) is also conveyance. Only a
     pure hosted-SaaS-that-never-hands-over-code would avoid it — and the on-prem wizard
     signals the opposite.

**Conclusion: "private" permits the *study*, not the *porting*.** The clean-room rule
below stands unchanged. If Odoo-derived code reaches either exit, LGPL applies to it.

> This is engineering guidance, not legal advice. For a commercial product, confirm the
> license boundary with a lawyer.

## 2. The real trap: porting, not copying

The danger is **not** only "copy-paste a file." Under LGPL:

> **Translating Odoo's Python logic into our TypeScript is still a derivative work.**

"I rewrote it in another language, so it's mine" is the exact misconception that creates
license contamination. Line-by-line porting of an Odoo module — even across languages — can
make our code subject to LGPL.

## 3. The safe way — clean-room, concept-level study

✅ **Allowed and encouraged:**
- Clone Odoo Community into a directory **outside this repo** (a sibling folder), read it,
  run it, click around.
- Learn **concepts**: how a chart of accounts composes, how tax rules chain to invoice
  lines, how a sales order flows to delivery and invoice, how the module/registry pattern
  works.
- Write *our own* implementation **from understanding**, in our own structure and naming.

❌ **Not allowed:**
- Copying Odoo source files into this repo.
- Porting an Odoo module line-by-line into TypeScript.
- Reading Odoo **Enterprise** for any of the above.
- Pasting Odoo code into the project "temporarily."

The test: *if you have the Odoo file open and you're transcribing it, stop.* If you closed
it and are writing from your understanding of the concept, you're fine.

## 4. Keep the clone out of the repo

The Odoo clone must never be committed here. It lives outside the project tree, and the
common accidental paths are git-ignored:

```gitignore
# Study material — NEVER commit (LGPL contamination risk)
/odoo/
/vendor-study/
/reference/odoo/
```

Recommended location: a sibling directory, e.g.
`~/Documents/GitHub/odoo-study/` — completely separate from `ERP-System/`.

```bash
# OUTSIDE this repo:
cd ~/Documents/GitHub
git clone --depth 1 -b 17.0 https://github.com/odoo/odoo.git odoo-study
```

## 5. What we deliberately borrow (concepts, not code)

| Odoo concept | What we take | What we write ourselves |
| --- | --- | --- |
| Modular app registry | The *idea* of pluggable modules | Our own `core/module-registry` |
| ORM data layer | The *pattern* (objects → SQL) | We use Drizzle |
| Chart of accounts / tax chaining | How the pieces relate | Our own schema + tax engine |
| Sales→delivery→invoice flow | The business sequence | Our own transactional code |

We copy the **architecture and domain understanding**, never the implementation.

## 6. When in doubt

If unsure whether something crosses the line, treat it as if it does, or get the change
reviewed. License contamination is cheap to avoid up front and expensive to remove later.
