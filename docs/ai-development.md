# AI development log

Selected tool: **Code0 / CodeZero AI IDE (`frigga.code0`, v1.1.9)**.

## Verified so far

- Extension installed into this workspace's ignored `.tools/extensions` directory.
- VS Code opened with that extension profile.
- Initial code created with Codex assistance, outside Code0.
- No Code0-generated change or review result has been recorded yet.

## Code0 tasks to complete before submission

These are proposed tasks, not completed usage claims. Run at least three through Code0, review the output, and record the actual result.

1. **API review:** inspect `server/app.js` and `server/validation.js` for missing validation and error-handling edge cases. Implement justified fixes.
2. **MongoDB testing:** review persistence and partial-update tests. Add a meaningful regression test for any discovered issue.
3. **React accessibility:** review `client/ApplicationForm.jsx` for keyboard, focus, labeling, and busy-state behavior. Apply and verify any improvements.
4. **Refactoring:** assess the dashboard component boundaries and extract a component where it improves readability.
5. **Documentation:** verify that the setup instructions match scripts and actual execution behavior.

For each completed session record: date, prompt, Code0 result, affected files, what you accepted or rejected, a specific issue you corrected, and the validation run afterward. Preserve genuine session excerpts or screenshots if available; omit credentials and personal data.

## Understanding the implementation

Be prepared to explain why PATCH preserves omitted fields; why input schemas reject unknown keys; why URL schemes are restricted; why search characters are escaped; how React handles failed requests without fabricating success; and what authentication/user isolation would require for deployment.
