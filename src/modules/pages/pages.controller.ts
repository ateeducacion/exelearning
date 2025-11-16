import { Controller, Get, Req, Redirect, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { randomBytes } from 'crypto';

const isOfflineMode = () => String(process.env.APP_ONLINE_MODE ?? '1') === '0';

@Controller()
export class PagesController {
  constructor(private readonly authService: AuthService) {}
  @Get('/login')
  async login(@Req() request: any, @Res() res: Response) {
    const offline = isOfflineMode();
    const defaultEmail =
      process.env.DEFAULT_USER_EMAIL || process.env.TEST_USER_EMAIL || 'user@exelearning.net';

    // Offline mode: auto-login with default/local user and skip login screen
    if (offline && request.session) {
      if (!request.session.userId) {
        let user = await this.authService.findByEmail(defaultEmail);
        if (!user) {
          user = await this.authService.findOrCreateExternalUser('offline-local', defaultEmail, ['ROLE_USER']);
        }
        if (user) {
          request.session.userId = user.id;
          request.session.email = user.email;
          request.session.isGuest = false;
          request.session.authMethodUsed = 'offline';
        }
      }

      const redirectTo = request.session?.targetPath || '/workarea';
      return res.redirect(302, redirectTo);
    }

    const authMethods = this.authService.getAuthMethods();
    const guestLoginNonce = authMethods.includes('guest') ? randomBytes(8).toString('hex') : null;
    if (guestLoginNonce && request.session) {
      (request as any).session.guestLoginNonce = guestLoginNonce;
    }

    let user = null;
    if (request.session?.userId) {
      if (request.session.isGuest) {
        user = {
          username: 'Guest',
          usernameFirsLetter: 'G',
        };
      } else {
        const dbUser = await this.authService.findById(request.session.userId);
        if (dbUser) {
          user = {
            username: dbUser.email.split('@')[0] || dbUser.email,
            usernameFirsLetter: (dbUser.email[0] || 'U').toUpperCase(),
          };
        } else {
          request.session.destroy();
        }
      }
    }

    const viewModel = {
      app_version: process.env.APP_VERSION || 'v3.0.0',
      auth_methods: authMethods,
      user,
      error: null,
      last_username: request.session?.email || '',
      csrf_token: 'temp-csrf-token', // TODO: Generate real CSRF token
      guest_login_nonce: guestLoginNonce,
      locale: 'en',
    };
    return res.render('security/login', viewModel);
  }

  @Get('/workarea')
  async workarea(@Req() request: any, @Res() res: Response) {
    // Check if user is authenticated
    if (!request.session || !request.session.userId) {
      if (request.session) {
        request.session.targetPath = request.originalUrl || '/workarea';
      }
      // Redirect to login if not authenticated
      return res.redirect('/login');
    }

    let user;

    // Check if this is a guest user
    if (request.session.isGuest) {
      // Guest user - use session data
      user = {
        username: 'Guest',
        usernameFirsLetter: 'G',
        acceptedLopd: true,
        odePlatformId: null,
        newOde: null,
        gravatarUrl: '',
      };
    } else {
      // Regular user - load from database
      const dbUser = await this.authService.findById(request.session.userId);
      if (!dbUser) {
        // User not found in database, clear session and redirect
        request.session.destroy();
        return res.redirect('/login');
      }

      user = {
        username: dbUser.email.split('@')[0] || dbUser.email,
        usernameFirsLetter: (dbUser.email[0] || 'U').toUpperCase(),
        acceptedLopd: dbUser.isLopdAccepted,
        odePlatformId: null,
        newOde: null,
        gravatarUrl: dbUser.getGravatarUrl(),
      };
    }

    const isOfflineInstallation =
      String(process.env.APP_ONLINE_MODE || '1') === '0' ||
      (process.env.APP_AUTH_METHODS || '').split(',').map((m) => m.trim().toLowerCase()).includes('none');

    // Mock/derived config data
    const config = {
      platformName: 'exelearning',
      platformType: 'standalone',
      platformUrlGet: '',
      platformUrlSet: '',
      clientCallWaitingTime: 2000,
      clientIntervalGetLastEdition: 5000,
      clientIntervalUpdate: 3000,
      defaultTheme: 'default',
      isOfflineInstallation,
      platformIntegration: false,
      userStyles: 0,
      userIdevices: 0,
    };

    // Mock symfony data
    const protocol = request.protocol || 'http';
    const host = request.get('host') || 'localhost:3001';
    const baseURL = `${protocol}://${host}`;

    console.log('Request info:', { protocol, host, baseURL });

    const symfony = {
      odeSessionId: null,
      environment: process.env.NODE_ENV || 'development',
      baseURL,
      basePath: '',
      fullURL: baseURL,
      changelogURL: '/CHANGELOG.md',
      filesDirPermission: {
        checked: true, // No permission errors in development mode
      },
      locale: 'en',
      themeTypeBase: 'base',
      themeTypeUser: 'user',
      ideviceTypeBase: 'base',
      ideviceTypeUser: 'user',
      ideviceVisibilityPreferencePre: 'exe_',
    };

    // Mock mercure data
    const mercure = {
      url: null,
      jwtSecretKey: null
    }; // Will be configured when implementing real-time features

    // Render the workarea template
    return res.render('workarea/workarea', {
      version: process.env.APP_VERSION || 'v3.0.0',
      app_version: process.env.APP_VERSION || 'v3.0.0', // For template compatibility
      expires: '',
      extension: '.elp',
      user,
      config,
      symfony,
      mercure,
      locale: 'en',
    });
  }

  @Get('/')
  @Redirect('/login', 302)
  root() {
    // Redirect to login
    return;
  }
}
