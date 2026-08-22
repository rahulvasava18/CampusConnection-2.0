import { connectMongo, disconnectMongo } from '../src/infrastructure/mongodb/connection';
import { UserModel } from '../src/modules/identity/infrastructure/user.model';
import { signupSchema } from '../src/modules/identity/interfaces/auth.schemas';
import { normalizeEmail, normalizeUsername } from '../src/modules/identity/security/credential-normalization';
import { hashPassword } from '../src/modules/identity/security/password.service';

const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN' as const;
const ACTIVE_ACCOUNT_STATE = 'ACTIVE' as const;
const VERIFIED_STATUS = 'VERIFIED' as const;

type ProvisioningUserModel = Pick<typeof UserModel, 'findOne' | 'create'>;

export interface PlatformAdminProvisioningInput {
  email: string;
  username: string;
  password: string;
}

export interface PlatformAdminProvisioningResult {
  status: 'created' | 'already_exists';
  email: string;
  username: string;
  role?: typeof PLATFORM_ADMIN_ROLE;
}

export class PlatformAdminProvisioningError extends Error {}

export async function provisionPlatformAdmin(
  input: PlatformAdminProvisioningInput,
  userModel: ProvisioningUserModel = UserModel,
): Promise<PlatformAdminProvisioningResult> {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);

  validateCredentials(email, username, input.password);

  const existingEmail = await userModel.findOne({
    $or: [{ emailNormalized: email }, { email }],
  });
  if (existingEmail) {
    return {
      status: 'already_exists',
      email,
      username:
        typeof existingEmail.username === 'string'
          ? normalizeUsername(existingEmail.username)
          : username,
    };
  }

  const existingPlatformAdmin = await userModel.findOne({ roles: PLATFORM_ADMIN_ROLE });
  if (existingPlatformAdmin) {
    throw new PlatformAdminProvisioningError(
      'A PLATFORM_ADMIN already exists. No administrator account was created.',
    );
  }

  const existingUsername = await userModel.findOne({
    $or: [{ usernameNormalized: username }, { username }],
  });
  if (existingUsername) {
    throw new PlatformAdminProvisioningError(
      'The requested administrator username is already in use. No account was created.',
    );
  }

  const passwordHash = await hashPassword(input.password);
  await userModel.create({
    username,
    usernameNormalized: username,
    email,
    emailNormalized: email,
    displayName: 'Platform Administrator',
    passwordHash,
    skills: [],
    interests: [],
    goals: [],
    accountState: ACTIVE_ACCOUNT_STATE,
    verificationStatus: VERIFIED_STATUS,
    roles: [PLATFORM_ADMIN_ROLE],
  });

  return { status: 'created', email, username, role: PLATFORM_ADMIN_ROLE };
}

function validateCredentials(email: string, username: string, password: string): void {
  if (!email) throw new PlatformAdminProvisioningError('PLATFORM_ADMIN_EMAIL is required.');
  if (!username) throw new PlatformAdminProvisioningError('PLATFORM_ADMIN_USERNAME is required.');
  if (!password) throw new PlatformAdminProvisioningError('PLATFORM_ADMIN_PASSWORD is required.');
  const validation = signupSchema.safeParse({
    displayName: 'Platform Administrator',
    username,
    email,
    password,
  });
  if (!validation.success) {
    throw new PlatformAdminProvisioningError(
      'Platform administrator credentials do not satisfy the existing signup validation rules.',
    );
  }
}

function readInput(): PlatformAdminProvisioningInput {
  return {
    email: process.env.PLATFORM_ADMIN_EMAIL ?? '',
    username: process.env.PLATFORM_ADMIN_USERNAME ?? '',
    password: process.env.PLATFORM_ADMIN_PASSWORD ?? '',
  };
}

async function main(): Promise<void> {
  let connectionAttempted = false;
  try {
    console.log('Platform admin provisioning started.');
    const input = readInput();
    validateCredentials(
      normalizeEmail(input.email),
      normalizeUsername(input.username),
      input.password,
    );
    connectionAttempted = true;
    await connectMongo();
    console.log('Database connection successful.');
    const result = await provisionPlatformAdmin(input);

    if (result.status === 'already_exists') {
      console.log('An account with the requested email already exists. No account was created.');
      console.log(`Email: ${result.email}`);
      console.log(`Username: ${result.username}`);
      return;
    }

    console.log('Admin account created successfully.');
    console.log(`Email: ${result.email}`);
    console.log(`Username: ${result.username}`);
    console.log(`Role: ${result.role}`);
  } catch (error) {
    const message =
      error instanceof PlatformAdminProvisioningError
        ? error.message
        : 'Unable to provision the platform administrator.';
    console.error(`Platform admin provisioning failed: ${message}`);
    process.exitCode = 1;
  } finally {
    if (connectionAttempted) {
      try {
        await disconnectMongo();
      } catch {
        process.exitCode = 1;
        console.error('Platform admin provisioning failed while closing the database connection.');
      }
    }
  }
}

if (require.main === module) {
  void main();
}
