# Platform administrator provisioning

`create-platform-admin.ts` is a one-time, manual provisioning utility. It is
not an application route and must never be exposed through the API.

Set temporary environment variables in the deployment shell or local terminal:

```text
PLATFORM_ADMIN_EMAIL=<real administrator email>
PLATFORM_ADMIN_USERNAME=<unique administrator username>
PLATFORM_ADMIN_PASSWORD=<strong unique password>
```

Run it from the repository root:

```text
npm run admin:create
```

Before connecting to MongoDB, validate the temporary credentials without any
database read or write:

```text
npm run admin:create -- --validate-only
```

Validation failures identify only the affected field and safe rule message; no
password or other secret is printed.

The script connects using the backend's existing `MONGO_URI`, `MONGO_DB_NAME`,
and environment configuration. It uses the existing User model, credential
normalization, and scrypt password hashing. The created account is `ACTIVE`,
`VERIFIED`, and has the existing `PLATFORM_ADMIN` role.

The operation is idempotent. An existing account with the requested email is
reported without creating a duplicate. If any `PLATFORM_ADMIN` already exists,
the script stops safely and requires deliberate operator intervention.

After successful provisioning, sign in through `/admin/login`, then remove the
temporary `PLATFORM_ADMIN_*` variables from the shell or deployment environment.
Never commit them, place them in source code, add them to `.env.example`, or
include them in a frontend build.
