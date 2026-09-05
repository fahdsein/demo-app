# Security guidance

This repository is a non-production deployment fixture.

- Report exposed credentials privately and revoke them immediately.
- Never commit `.env`, tokens, database URLs containing passwords, private keys, or cloud access keys.
- Grant deployment integrations access to this repository only.
- Use test-only infrastructure and short-lived credentials.
- Remove the NEO GitHub authorization, webhooks, and deploy keys after testing if they are no longer required.
- Keep generated test data free of personal, confidential, and production information.

