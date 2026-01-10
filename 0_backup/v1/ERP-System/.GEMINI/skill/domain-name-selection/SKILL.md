---
name: domain-name-selection
description: "Select a strong, brand-safe domain name and choose the best available option by checking naming fit, availability, trademark risk, and practical constraints."
version: "1.0"
tags: [workflow, sop, dev, docs]
---

# Goal
Pick a domain name that is memorable, on-brand, low-risk (trademark/confusion), and practical to buy and use (available, reasonable price, and compatible with email/marketing needs).

# When to Use
- You need to name a new product, company, project, or landing page and want a repeatable domain-selection process.
- You have a shortlist of names and need to pick the best domain to register.

# Inputs
- Brand/product context: what it is, who it’s for, and the tone (serious/playful/technical/luxury).
- Must-have terms: keywords, brand name, acronyms, or required words (if any).
- Audience & geography: primary markets/languages and any region-specific needs.
- Use cases: marketing site, app, email, docs, subdomains, redirects.
- Budget: target annual cost and max acceptable purchase price.
- Constraints:
  - Prefer select-only checks first (availability/trademark research) before paying for anything.
  - Avoid names that are confusingly similar to existing competitors or registered trademarks.
  - Avoid hyphens and numbers unless explicitly desired.

# Output
- A ranked shortlist (3–10) of domain candidates with reasoning.
- One recommended primary domain to register (plus 1–3 defensive registrations, if appropriate).
- A registration checklist (what to buy, where, and what settings to configure).

# Procedure
1. Clarify the naming brief.
   - Write 1 sentence: “This is for <X> for <Y> who want <Z>.”
   - List must-have and must-avoid words, and the desired tone.
2. Generate candidate names (start wide, then narrow).
   - Create 20–40 name candidates using: real words, blends, invented brandables, abbreviations, or category+brand patterns.
   - Filter out hard-to-spell, ambiguous pronunciation, and “looks-like-a-typo” names.
3. Create domain variants for each candidate.
   - Prefer: `<brand>.com`.
   - Also consider: `<brand>.io`, `<brand>.co`, `<brand>app.com`, `<getbrand>.com`, or a relevant ccTLD only if it fits the market.
4. Score each candidate (quick rubric).
   - Memorability (0–3), spelling/pronunciation (0–3), brand fit (0–3), uniqueness (0–3), length (0–2), and “confusable risk” (0–3, lower is better).
   - Drop anything that fails: hard to say, easy to mistype, or likely to be confused with an existing known brand.
5. Check availability and price.
   - Use a reputable registrar search to check if the domains are available and at what price.
   - Flag suspicious pricing (e.g., premium domains) and recurring renewal cost.
6. Check trademark/confusion risk (lightweight, then deeper if needed).
   - Quick scan: search the exact name + category on the web.
   - Trademark scan: search relevant trademark databases for identical/near-identical marks in related categories.
   - If risk is unclear, prefer a different name or ask for legal review before registering.
7. Check operational fit.
   - Verify email friendliness (no weird characters; not easily mistaken in speech).
   - If you need social presence, check handle availability for the top candidates (optional but recommended).
8. Choose the recommendation and defensive options.
   - Pick the best available candidate that balances brand fit, low confusion risk, and reasonable cost.
   - If budget allows, register 1–3 defensive domains (common misspellings or key TLD variants) and redirect them to the primary.
9. Register and record.
   - Register the chosen domain(s) with auto-renew enabled.
   - Store registrar, renewal date, and DNS settings location in your project docs.

# Verification (Acceptance Checks)
- [ ] Shortlist includes reasoning, scores, and availability/pricing for each candidate.
- [ ] Recommended domain is available (or an explicit fallback is chosen).
- [ ] Trademark/confusion risk is documented (at least a quick scan) and any high-risk options are excluded.

# Failure Modes & Recovery
- **If all good candidates are taken**: broaden name generation (add prefixes/suffixes, try brandable invented names) → repeat availability + risk checks.
- **If a domain is “premium” priced**: compare long-term renewal costs and alternatives → choose a different variant or candidate.
- **If trademark risk seems high**: discard the candidate → pick the next best low-risk option.
- **If missing info**: ask user “What is this domain for (product/company/project), who is the audience, and do you require a specific TLD (like .com)?”

# Examples
## Example A
**User request:** “Help me choose a domain for a budgeting app for freelancers called ‘LedgerLeaf’.”
**What you do:** Generate variants (`ledgerleaf.com`, `ledgerleafapp.com`, etc.) → score for memorability/spelling → check availability + renewal cost → scan for trademark/confusion → recommend primary + 1–2 defensive domains.
**Result:** A ranked shortlist and a final recommendation (with availability, price, and risk notes).

# Notes (optional)
- If .com is unavailable, prefer a clean modifier (`<brand>app.com`) over unusual TLDs unless your audience is already comfortable with them.
- For business-critical brands, consider a legal trademark search/review before heavy marketing spend.
