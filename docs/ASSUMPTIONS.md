# HR/Admin MVP assumptions

Date: 2026-09-29. These are implementation choices for the local development
MVP; source contracts and tests take precedence if they conflict.

1. A Company profile belongs to the active authenticated `masterFn` and
   `companyFn`. A user with `settings.read` may view it; only a user with
   `settings.manage` may edit it. Neither Company identity nor country, currency
   or tax regime is editable from this profile form.
2. Registration number, tax number and postal address are optional until the
   Company supplies them. Saving trims values and enforces bounded lengths.
   The address uses line 1, line 2, city and postal code rather than imposing
   one country's address format on both SG and MY.
3. A Company logo is an optional PNG, JPEG or WebP image up to 256 KiB.
   The shared command validates its declared MIME type, bytes and signature;
   SVG is excluded because it can contain active content. Clearing a logo is
   an explicit user action.
4. Profile edits are versioned and audited. The current Company name is updated
   in the canonical `company` row; the remaining profile fields are stored in
   a Company-scoped record so they do not inflate ordinary tenant listings.
5. The Odoo project KB is concept research, not an implementation source. Its
   form-save note reinforces verifying server readback after save. The current
   ERP source and tests own the behavior here.
6. Staff directory status uses the canonical `employee.isActive` flag. An
   employee on approved leave is still current staff; former staff retain
   their record and history. The Job title filter uses `employee.jobTitle`,
   not application permission roles. Headcount counts current staff only.
7. Ending employment for an employee without a login account requires an HR
   reason and current record version. Active direct reports must be handed to
   an eligible current employee outside the source reporting subtree. A linked
   login account still uses the existing account offboarding command so its
   sessions and ownership are handled together. Employment end does not
   automatically decide or erase governed Leave Applications.
8. A pending or approved absence occupies its chargeable calendar dates for
   that employee. A same-day AM half day and PM half day may coexist; a full
   day or duplicate half day may not. HR approval checks approved records
   again so an imported historical overlap cannot be approved twice.

These assumptions can be revised when verified user or product requirements
provide a more specific contract.
