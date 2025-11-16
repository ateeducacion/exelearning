import { Controller, Get, Render, Req, Redirect, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';

@Controller()
export class PagesController {
  constructor(private readonly authService: AuthService) {}
  @Get('/login')
  @Render('security/login')
  login(@Req() request: Request) {
    // Get environment variables for authentication methods
    const authMethods = ['password', 'guest']; // For now, hardcode. Later read from config

    return {
      app_version: process.env.APP_VERSION || 'v3.0.0',
      auth_methods: authMethods,
      user: null, // Will be populated from session later
      error: null,
      last_username: '',
      csrf_token: 'temp-csrf-token', // TODO: Generate real CSRF token
      guest_login_nonce: null,
      locale: 'en',
    };
  }

  @Get('/workarea')
  async workarea(@Req() request: any, @Res() res: Response) {
    // Check if user is authenticated
    if (!request.session || !request.session.userId) {
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

    // Mock config data
    const config = {
      platformName: 'exelearning',
      platformType: 'standalone',
      platformUrlGet: '',
      platformUrlSet: '',
      clientCallWaitingTime: 2000,
      clientIntervalGetLastEdition: 5000,
      clientIntervalUpdate: 3000,
      defaultTheme: 'default',
      isOfflineInstallation: true, // Set to true until Mercure is configured
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
