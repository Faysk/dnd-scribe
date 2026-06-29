# Craig upload storage preflight

Status: implemented in the upload workspace.

## Goal

A large Craig ZIP can be valid but still risky for storage. The upload screen should make that visible before the operator sends the file to R2.

## Behavior

The browser now evaluates the selected ZIP before upload:

- up to the retained-session target: green informational notice;
- above `250 MiB`: attention notice explaining that raw ZIP is above the desired retained archive target and should be compacted/cleaned after processing;
- above `1200 MiB`: stronger attention notice for a large R2 object;
- above `2 GiB`: client-side block, matching the server upload maximum.

The warning does not re-render the file input after selection, so the browser does not lose the selected ZIP. It updates only the preview and preflight notice.

## Confirmation

When the selected ZIP is above the attention threshold, the upload flow asks for explicit confirmation before requesting the signed R2 URL. This protects accidental uploads while still allowing a real session file when the operator intentionally accepts the temporary storage hit.

No OpenAI cost is introduced by this step.
