import { AuthService } from '../../../src/modules/auth/auth.service';
import { User } from '../../../src/entities/user.entity';

describe('AuthService - external users', () => {
  const buildConfig = (overrides: Record<string, any> = {}) => ({
    get: jest.fn((key: string) => {
      if (overrides[key] !== undefined) {
        return overrides[key];
      }
      switch (key) {
        case 'APP_AUTH_METHODS':
          return 'password,cas,openid,guest';
        case 'AUTH_TEMP_EMAIL_DOMAIN':
          return 'domain.test';
        case 'AUTH_CREATE_USERS':
          return 'true';
        default:
          return undefined;
      }
    }),
  });

  const buildService = (options: { overrides?: Record<string, any>; existingUser?: Partial<User> | null } = {}) => {
    const existingUser = options.existingUser ?? null;
    const repo = {
      findOne: jest.fn()
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null),
      create: jest.fn((data: any) => data),
      save: jest.fn(async (data: any) => ({ id: 99, ...data })),
    };

    const jwt = { sign: jest.fn() };
    const config = buildConfig(options.overrides);

    return { service: new AuthService(repo as any, jwt as any, config as any), repo, config };
  };

  it('returns existing external user if found', async () => {
    const existing = { id: 5, email: 'cas@example.com', externalIdentifier: 'cas:user' } as User;
    const { service, repo } = buildService({ existingUser: existing });

    const user = await service.findOrCreateExternalUser('cas:user', 'cas@example.com');

    expect(user).toBe(existing);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('creates a new external user when allowed', async () => {
    const { service, repo } = buildService();

    const user = await service.findOrCreateExternalUser('oidc:abc123', undefined);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: expect.stringMatching(/@domain\.test$/),
        externalIdentifier: 'oidc:abc123',
        roles: ['ROLE_USER'],
        isLopdAccepted: true,
      }),
    );
    expect(user.email).toMatch(/@domain\.test$/);
    expect(user.password).toBeDefined();
    expect(user.id).toBe(99);
  });

  it('denies creation when AUTH_CREATE_USERS is false', async () => {
    const { service } = buildService({ overrides: { AUTH_CREATE_USERS: 'false' }, existingUser: null });

    await expect(service.findOrCreateExternalUser('oidc:nope', 'user@example.com')).rejects.toThrow(
      /External users are not allowed/i,
    );
  });
});
