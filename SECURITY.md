# Security Policy

## API keys

Never commit a real DashScope API Key. Use `backend/.env.example` as the template and keep the real `backend/.env` local. The application intentionally never returns the stored key from its API.

The web-based key setup endpoint is restricted to loopback clients and loopback browser origins. For a remote deployment, configure secrets on the server and do not expose the key-management endpoint through an untrusted proxy.

## User data

Transcript images, generated audio, SQLite databases, sessions and backups may contain personal or copyrighted material. They are excluded from Git by default and should not be attached to public bug reports.

## Reporting a vulnerability

Please open a GitHub security advisory for vulnerabilities. Do not include real API keys, private transcripts, uploaded images or generated audio in the report.
