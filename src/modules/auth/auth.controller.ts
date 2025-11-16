import { Controller, Post, Body, Get, Req, UseGuards, Redirect, Res, Put, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { randomBytes, createHash } from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { AuthService } from './auth.service';
import { buildAbsoluteUrl, decodeJwtPayload } from './auth.utils';
import { UserPreferencesService } from '../user-preferences/user-preferences.service';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly userPreferencesService: UserPreferencesService,
  ) {}

  private authMethods(): string[] {
    return this.authService.getAuthMethods();
  }

  private targetAfterLogin(req: Request): string {
    const sessionTarget = (req as any).session?.postLoginRedirect || (req as any).session?.targetPath;
    if ((req as any).session) {
      delete (req as any).session.postLoginRedirect;
      delete (req as any).session.targetPath;
    }

    return sessionTarget || '/workarea';
  }

  // API endpoints (mantener compatibilidad)
  @Post('api/auth/login')
  async apiLogin(@Body() loginDto: { email: string; password: string }) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('api/auth/logout')
  async apiLogout(@Req() req: any) {
    // TODO: Implement logout logic
    return { message: 'Logged out successfully' };
  }

  @Get('api/auth/check')
  async checkAuth(@Req() req: any) {
    const authenticated = !!(req.session && req.session.userId);
    return { authenticated };
  }

  @Get('api/session/check')
  async checkSession(@Req() req: any) {
    const authenticated = !!(req.session && req.session.userId);
    return {
      authenticated,
      active: authenticated,
      user: authenticated ? { id: req.session.userId, email: req.session.email } : null
    };
  }

  @Get('api/parameter-management/parameters/data/list')
  async getParameters() {
    // Return parameters in the expected format with necessary routes
    return {
      routes: {
        api_translations_list_by_locale: {
          path: '/api/translations/{locale}',
          methods: ['GET']
        },
        api_idevices_installed: {
          path: '/api/idevice/installed',
          methods: ['GET']
        },
        api_themes_installed: {
          path: '/api/theme/installed',
          methods: ['GET']
        },
        api_user_preferences_get: {
          path: '/api/user/preferences',
          methods: ['GET']
        },
        api_user_preferences_save: {
          path: '/api/user/preferences',
          methods: ['PUT']
        },
        api_current_ode_users_for_user_get: {
          path: '/api/project/current',
          methods: ['GET']
        },
        api_odes_properties_get: {
          path: '/api/project/{odeSessionId}/properties',
          methods: ['GET']
        },
        api_odes_last_updated: {
          path: '/api/project/{odeId}/last-updated',
          methods: ['GET']
        },
        api_odes_current_users: {
          path: '/api/project/{odeId}/version/{odeVersionId}/session/{odeSessionId}/users',
          methods: ['GET']
        },
        api_nav_structures_nav_structure_get: {
          path: '/api/project/version/{odeVersionId}/session/{odeSessionId}/structure',
          methods: ['GET']
        },
        api_idevices_list_by_page: {
          path: '/api/idevice/{odeNavStructureSyncId}/list/page',
          methods: ['GET']
        },
        api_odes_clean_init_autosave_elp: {
          path: '/api/project/clean/init/autosave/elp',
          methods: ['POST']
        },
        api_odes_remove_date_ode_files: {
          path: '/api/ode-management/odes/remove/date/ode/files',
          methods: ['POST']
        },
        api_nav_structures_nav_structure_data_save: {
          path: '/api/nav-structure-management/nav-structures/nav/structure/data/save',
          methods: ['PUT']
        },
        api_odes_properties_save: {
          path: '/api/ode-management/odes/properties/save',
          methods: ['PUT']
        },
        current_ode_users_update_flag: {
          path: '/api/current-ode-users-management/current-ode-user/current/ode/users/update/flag',
          methods: ['POST']
        },
        api_odes_check_before_leave_ode_session: {
          path: '/api/ode-management/odes/check/before/leave/ode/session',
          methods: ['POST']
        },
        api_odes_ode_session_close: {
          path: '/api/ode-management/odes/ode/session/close',
          methods: ['POST']
        },
        api_ode_export_download: {
          path: '/api/ode-export/{odeSessionId}/{exportType}/download',
          methods: ['GET']
        },
        api_ode_export_preview: {
          path: '/api/ode-export/{odeSessionId}/preview',
          methods: ['GET']
        },
        api_odes_ode_save_manual: {
          path: '/api/ode-management/odes/ode/save/manual',
          methods: ['POST']
        },
        api_odes_ode_save_auto: {
          path: '/api/ode-management/odes/ode/save/auto',
          methods: ['POST']
        },
        api_odes_user_get_ode_list: {
          path: '/api/project/get/user/ode/list',
          methods: ['GET']
        },
        api_odes_ode_local_elp_open: {
          path: '/api/project/open',
          methods: ['POST']
        },
        api_odes_ode_local_large_elp_open: {
          path: '/api/project/open',
          methods: ['POST']
        }
      },
      baseUrl: '/api',
      version: '3.0.0',
      userPreferencesConfig: {},
      odeNavStructureSyncPropertiesConfig: {
        titleNode: {
          title: 'Title',
          type: 'text',
          category: 'General',
          heritable: false,
          value: ''
        },
        hidePageTitle: {
          title: 'Hide page title',
          type: 'checkbox',
          category: 'General',
          value: 'false',
          heritable: false
        },
        titleHtml: {
          title: 'Title HTML',
          type: 'text',
          category: 'Advanced (SEO)',
          heritable: false,
          value: ''
        },
        editableInPage: {
          title: 'Different title on the page',
          type: 'checkbox',
          category: 'General',
          value: 'false',
          alwaysVisible: true
        },
        titlePage: {
          title: 'Title in page',
          type: 'text',
          category: 'General',
          heritable: false,
          value: ''
        },
        visibility: {
          title: 'Visible in export',
          value: 'true',
          type: 'checkbox',
          category: 'General',
          heritable: true
        },
        highlight: {
          title: 'Highlight this page in the website navigation menu',
          value: 'false',
          type: 'checkbox',
          category: 'General',
          heritable: false
        },
        description: {
          title: 'Description',
          type: 'textarea',
          category: 'Advanced (SEO)',
          heritable: false,
          value: ''
        }
      },
      odeProjectSyncPropertiesConfig: {
        properties: {
          pp_title: {
            title: 'Title',
            help: 'The name given to the resource.',
            alwaysVisible: true,
            type: 'text',
            category: 'properties',
            groups: ['properties_package'],
            value: ''
          },
          pp_subtitle: {
            title: 'Subtitle',
            help: 'Adds additional information to the main title.',
            alwaysVisible: true,
            type: 'text',
            category: 'properties',
            groups: ['properties_package'],
            value: ''
          },
          pp_lang: {
            title: 'Language',
            help: 'Select a language.',
            value: 'en',
            alwaysVisible: true,
            type: 'select',
            options: {
              'en': 'English',
              'es': 'Español',
              'fr': 'Français',
              'de': 'Deutsch',
              'it': 'Italiano',
              'pt': 'Português'
            },
            category: 'properties',
            groups: ['properties_package']
          },
          pp_author: {
            title: 'Authorship',
            help: 'Primary author/s of the resource.',
            alwaysVisible: true,
            type: 'text',
            category: 'properties',
            groups: ['properties_package'],
            value: ''
          },
          pp_license: {
            title: 'License',
            value: 'creative-commons-attribution-share-alike-4.0',
            alwaysVisible: true,
            type: 'select',
            options: {
              'creative-commons-attribution-share-alike-4.0': 'CC BY-SA 4.0'
            },
            category: 'properties',
            groups: ['properties_package']
          },
          pp_description: {
            title: 'Description',
            alwaysVisible: true,
            type: 'textarea',
            category: 'properties',
            groups: ['properties_package'],
            value: ''
          }
        },
        export: {
          exportSource: {
            title: 'Editable export',
            value: 'true',
            help: 'The exported content will be editable with eXeLearning.',
            type: 'checkbox',
            category: 'properties',
            groups: ['export']
          },
          pp_addExeLink: {
            title: '"Made with eXeLearning" link',
            value: 'true',
            help: 'Help us spreading eXeLearning. Checking this option, a "Made with eXeLearning" link will be displayed in your pages.',
            type: 'checkbox',
            category: 'properties',
            groups: ['export']
          },
          pp_addPagination: {
            title: 'Page counter',
            value: 'false',
            help: 'A text with the page number will be added on each page.',
            type: 'checkbox',
            category: 'properties',
            groups: ['export']
          },
          pp_addSearchBox: {
            title: 'Search bar (Website export only)',
            value: 'false',
            help: 'A search box will be added to every page of the website.',
            type: 'checkbox',
            category: 'properties',
            groups: ['export']
          },
          pp_addAccessibilityToolbar: {
            title: 'Accessibility toolbar',
            value: 'false',
            help: 'The accessibility toolbar allows visitors to manipulate some aspects of your site, such as font and text size.',
            type: 'checkbox',
            category: 'properties',
            groups: ['export']
          },
          pp_extraHeadContent: {
            title: 'HEAD',
            help: 'HTML to be included at the end of HEAD: LINK, META, SCRIPT, STYLE...',
            alwaysVisible: true,
            type: 'textarea',
            category: 'properties',
            groups: ['custom_code'],
            value: ''
          },
          footer: {
            title: 'Page footer',
            help: 'Type any HTML. It will be placed after every page content. No JavaScript code will be executed inside eXe.',
            alwaysVisible: true,
            type: 'textarea',
            category: 'properties',
            groups: ['custom_code'],
            value: ''
          }
        }
      },
      odeProjectSyncCataloguingConfig: {},
      themeInfoFieldsConfig: {
        title: {
          title: 'Title',
          tag: 'text'
        },
        description: {
          title: 'Description',
          tag: 'textarea'
        },
        version: {
          title: 'Version',
          tag: 'text'
        },
        author: {
          title: 'Authorship',
          tag: 'text'
        },
        authorUrl: {
          title: 'Author URL',
          tag: 'text'
        },
        license: {
          title: 'License',
          tag: 'textarea'
        },
        licenseUrl: {
          title: 'License URL',
          tag: 'textarea'
        }
      },
      themeEditionFieldsConfig: {
        title: {
          title: 'Title',
          tag: 'text',
          config: 'title',
          category: 'Information'
        },
        description: {
          title: 'Description',
          tag: 'textarea',
          config: 'description',
          category: 'Information'
        },
        version: {
          title: 'Version',
          tag: 'text',
          config: 'version',
          category: 'Information'
        },
        author: {
          title: 'Authorship',
          tag: 'text',
          config: 'author',
          category: 'Information'
        },
        authorUrl: {
          title: 'Author URL',
          tag: 'text',
          config: 'author-url',
          category: 'Information'
        },
        license: {
          title: 'License',
          tag: 'textarea',
          config: 'license',
          category: 'Information'
        },
        licenseUrl: {
          title: 'License URL',
          tag: 'textarea',
          config: 'license-url',
          category: 'Information'
        },
        textColor: {
          title: 'Text color',
          tag: 'color',
          config: 'text-color',
          category: 'Texts and Links'
        },
        linkColor: {
          title: 'Links color',
          tag: 'color',
          config: 'link-color',
          category: 'Texts and Links'
        },
        headerImg: {
          title: 'Header image',
          tag: 'img',
          config: 'header-img',
          category: 'Header'
        },
        logoImg: {
          title: 'Logo image',
          tag: 'img',
          config: 'logo-img',
          category: 'Header'
        }
      },
      mercure: {
        url: null,
        jwtSecretKey: null
      },
      config: {
        isOfflineInstallation: true // Set to true until Mercure is configured
      }
    };
  }

  @Get('api/translations/:locale')
  async getTranslations(@Req() req: any) {
    // Return empty translations for now
    // TODO: Implement real translations loading
    return {
      translations: {},
      locale: req.params.locale || 'en'
    };
  }

  @Get('api/idevice/installed')
  async getIdevicesInstalled() {
    // Return empty idevices list for now
    // TODO: Implement real idevices loading from filesystem
    return {
      idevices: []
    };
  }

  @Get('api/theme/installed')
  async getThemesInstalled() {
    // Return default theme for now
    // TODO: Implement real themes loading from filesystem
    return {
      themes: [
        {
          name: 'default',
          dirName: 'default',
          title: 'Default Theme',
          version: '1.0',
          author: 'eXeLearning',
          authorUrl: '',
          license: 'GPL',
          licenseUrl: '',
          description: 'Default eXeLearning theme',
          type: 'base',
          url: '/style/base/default',
          cssFiles: [],
          jsFiles: [],
          templatePage: null,
          templateIdevice: null,
          templatePageContainerClass: 'page-content-template-container',
          templatePageClass: 'page-content-template'
        }
      ]
    };
  }

  @Get('api/user/preferences')
  async getUserPreferences(@Req() req: any) {
    // Get user ID from session or use default
    const userId = req.session?.user?.userId || req.user?.userId || 'user@exelearning.net';

    // Get preferences from database
    const preferences = await this.userPreferencesService.getPreferencesObject(userId);

    // Convert to expected format { key: { value: 'val' } }
    const formattedPreferences: Record<string, { value: string }> = {};
    for (const [key, value] of Object.entries(preferences)) {
      formattedPreferences[key] = { value };
    }

    // Set defaults if preferences don't exist
    if (!preferences['advancedMode']) {
      formattedPreferences['advancedMode'] = { value: 'true' };
    }
    if (!preferences['versionControl']) {
      formattedPreferences['versionControl'] = { value: 'false' };
    }
    if (!preferences['locale']) {
      formattedPreferences['locale'] = { value: 'en' };
    }

    return {
      userPreferences: formattedPreferences
    };
  }

  @Get('api/project/current')
  async getCurrentProject(@Req() req: any) {
    // Return null for now - no current project
    // TODO: Implement real project loading from session/database
    return null;
  }

  @Get('api/project/:odeSessionId/properties')
  async getOdeProperties(@Req() req: any) {
    // Return empty properties for now
    // TODO: Implement real project properties from database
    return {
      odeProperties: {},
      odeVersionName: '1.0.0'
    };
  }

  @Get('api/config/upload-limits')
  async getUploadLimits() {
    // Return default upload limits
    // TODO: Get actual limits from PHP configuration
    return {
      maxFileSize: 10485760, // 10MB in bytes
      maxFileSizeFormatted: '10 MB',
      limitingFactor: 'application',
      details: {
        phpPostMaxSize: '10M',
        phpUploadMaxFilesize: '10M',
        applicationMaxSize: '10M'
      }
    };
  }

  @Get('api/project/:odeId/last-updated')
  async getOdeLastUpdated(@Req() req: any) {
    // Return last updated timestamp
    // TODO: Implement real last updated from database
    return {
      lastUpdated: new Date().toISOString()
    };
  }

  @Get('api/project/:odeId/version/:odeVersionId/session/:odeSessionId/users')
  async getOdeConcurrentUsers(@Req() req: any) {
    // Return concurrent users list
    // TODO: Implement real concurrent users from database
    return {
      currentUsers: []
    };
  }

  @Get('api/project/version/:odeVersionId/session/:odeSessionId/structure')
  async getOdeStructure(@Req() req: any) {
    // Return empty structure for now
    // TODO: Implement real structure from database
    return {
      structure: []
    };
  }

  @Get('api/idevice/:odeNavStructureSyncId/list/page')
  async getIdevicesListByPage(@Req() req: any) {
    // Return empty idevices list for now
    // TODO: Implement real idevices list from database
    return {
      idevices: []
    };
  }

  @Post('api/project/clean/init/autosave/elp')
  async cleanInitAutosaveElp(@Req() req: any) {
    // Clean autosave files for user
    // TODO: Implement real autosave cleaning from filesystem
    return {
      success: true,
      message: 'Autosaves cleaned'
    };
  }

  @Post('api/ode-management/odes/remove/date/ode/files')
  async removeOdeFilesByDate(@Body() body: any, @Req() req: any) {
    // Remove ODE files by date
    // TODO: Implement real file removal from filesystem/database
    return {
      success: true,
      message: 'Files removed by date'
    };
  }

  @Put('api/nav-structure-management/nav-structures/nav/structure/data/save')
  async saveNavStructureData(@Body() body: any, @Req() req: any) {
    // Save navigation structure (page) data
    // TODO: Implement real navigation structure saving to database

    // Generate a new ID for the navigation structure if it's a new node
    const isNewNode = !body.odeNavStructureSyncId || body.odeNavStructureSyncId === '';
    const odeNavStructureSyncId = isNewNode ? Date.now() : body.odeNavStructureSyncId;

    return {
      odeNavStructureSyncId: odeNavStructureSyncId,
      isNewOdeNavStructureSync: isNewNode,
      odeNavStructureSync: null,  // Full structure not needed for now
      odeNavStructureSyncs: []    // Modified structures not needed for now
    };
  }

  @Put('api/ode-management/odes/properties/save')
  async saveOdeProperties(@Body() body: any, @Req() req: any) {
    // Save project properties
    // TODO: Implement real project properties saving to database
    return {
      success: true,
      message: 'Properties saved',
      odeProperties: body.odeProperties || {}
    };
  }

  @Post('api/current-ode-users-management/current-ode-user/current/ode/users/update/flag')
  async currentOdeUsersUpdateFlag(@Body() body: any, @Req() req: any) {
    // Update flag for concurrent users
    // TODO: Implement real concurrent user notification via Mercure/WebSocket
    return {
      success: true,
      message: 'Update flag activated'
    };
  }

  @Post('api/ode-management/odes/check/before/leave/ode/session')
  async checkBeforeLeaveOdeSession(@Body() body: any, @Req() req: any) {
    // Check if there are other users before leaving the session
    // TODO: Implement real concurrent user check from database
    return {
      currentUsers: 0,  // No other users in development mode
      shouldAskToSave: false
    };
  }

  @Post('api/ode-management/odes/ode/session/close')
  async closeOdeSession(@Body() body: any, @Req() req: any) {
    // Close ODE session
    // TODO: Implement real session cleanup from database
    return {
      success: true,
      message: 'Session closed'
    };
  }

  @Get('api/ode-export/:odeSessionId/:exportType/download')
  async downloadExport(
    @Param('odeSessionId') odeSessionId: string,
    @Param('exportType') exportType: string,
    @Req() req: any
  ) {
    // Export download endpoint
    // TODO: Implement real file export and download
    // For now, return error indicating feature not implemented in development
    return {
      error: 'Export functionality not yet implemented in NestJS backend',
      odeSessionId,
      exportType
    };
  }

  @Get('api/ode-export/:odeSessionId/preview')
  async previewExport(
    @Param('odeSessionId') odeSessionId: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    // Preview export endpoint
    // Check if odeSessionId is valid
    if (!odeSessionId || odeSessionId === 'undefined') {
      return res.status(400).json({
        responseMessage: 'error: No project session available. Please open or create a project first.',
        error: 'INVALID_SESSION'
      });
    }

    // TODO: Implement real HTML5 export generation
    // For now, return error indicating feature not implemented
    return res.status(501).json({
      responseMessage: 'error: Preview functionality not yet implemented in NestJS backend',
      error: 'NOT_IMPLEMENTED',
      odeSessionId
    });
  }

  @Get('api/ode-management/odes/:odeId/last-updated')
  async getLastUpdated(
    @Param('odeId') odeId: string,
    @Req() req: any
  ) {
    // Get last updated timestamp for ODE
    // TODO: Implement real timestamp tracking from database
    return {
      lastUpdated: Date.now(),
      odeId
    };
  }

  @Post('api/ode-management/odes/ode/save/manual')
  async saveOdeManual(@Body() body: any, @Req() req: any) {
    // Manual save endpoint
    // TODO: Implement real save to database/file system
    return {
      success: true,
      message: 'Manual save completed (placeholder)',
      timestamp: Date.now()
    };
  }

  @Post('api/ode-management/odes/ode/save/auto')
  async saveOdeAuto(@Body() body: any, @Req() req: any) {
    // Auto save endpoint
    // TODO: Implement real autosave to database/file system
    return {
      success: true,
      message: 'Auto save completed (placeholder)',
      timestamp: Date.now()
    };
  }

  @Get('login/cas')
  async casLogin(@Req() req: Request, @Res() res: Response) {
    const methods = this.authMethods();
    if (!methods.includes('cas')) {
      return res.status(404).render('security/error', { error: 'CAS authentication is not enabled.' });
    }

    const casUrl = (this.configService.get<string>('CAS_URL') || '').replace(/\/$/, '');
    const casLoginPath = (this.configService.get<string>('CAS_LOGIN_PATH') || '/login').replace(/^\//, '');

    if (!casUrl || !casLoginPath) {
      return res.status(500).render('security/error', { error: 'CAS authentication is misconfigured.' });
    }

    const serviceUrl = buildAbsoluteUrl(req, '/login/cas/callback');

    if ((req as any).session) {
      (req as any).session.authMethodUsed = 'cas';
      (req as any).session.postLoginRedirect = (req as any).session.targetPath || '/workarea';
    }

    const loginUrl = `${casUrl}/${casLoginPath}?service=${encodeURIComponent(serviceUrl)}`;
    return res.redirect(loginUrl);
  }

  @Get('login/cas/callback')
  async casCallback(@Req() req: Request, @Res() res: Response, @Query('ticket') ticket?: string) {
    const methods = this.authMethods();
    if (!methods.includes('cas')) {
      return res.status(404).render('security/error', { error: 'CAS authentication is not enabled.' });
    }

    if (!ticket) {
      return res.status(400).render('security/error', { error: 'Missing CAS ticket.' });
    }

    const casUrl = (this.configService.get<string>('CAS_URL') || '').replace(/\/$/, '');
    const casValidatePath = (this.configService.get<string>('CAS_VALIDATE_PATH') || '/p3/serviceValidate').replace(/^\//, '');
    if (!casUrl || !casValidatePath) {
      return res.status(500).render('security/error', { error: 'CAS authentication is misconfigured.' });
    }

    const serviceUrl = buildAbsoluteUrl(req, '/login/cas/callback');
    const fetchFn = (global as any).fetch;

    if (!fetchFn) {
      return res.status(500).render('security/error', { error: 'Fetch API is not available to perform CAS validation.' });
    }

    try {
      const validateUrl = `${casUrl}/${casValidatePath}?service=${encodeURIComponent(serviceUrl)}&ticket=${encodeURIComponent(ticket)}`;
      const response = await fetchFn(validateUrl);
      const body = await response.text();
      const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
      const parsed = parser.parse(body);
      const authSuccess = parsed?.serviceResponse?.authenticationSuccess;
      const casUser = authSuccess?.user;

      if (!authSuccess || !casUser) {
        return res.status(401).render('security/error', { error: 'CAS authentication failed.' });
      }

      const attributes = authSuccess.attributes || {};
      const pickAttribute = (value: any) => (Array.isArray(value) ? value[0] : value);
      const email =
        pickAttribute(attributes.mail) ||
        pickAttribute(attributes.email) ||
        pickAttribute(attributes.mailAddress) ||
        pickAttribute(attributes['cas:mail']);

      const user = await this.authService.findOrCreateExternalUser(`cas:${casUser}`, email || undefined);

      if ((req as any).session) {
        (req as any).session.userId = user.id;
        (req as any).session.email = user.email;
        (req as any).session.authMethodUsed = 'cas';
        (req as any).session.isGuest = false;
        (req as any).session.casAttributes = attributes;
      }

      return res.redirect(this.targetAfterLogin(req));
    } catch (error) {
      console.error('CAS authentication error:', error);
      return res.status(500).render('security/error', { error: 'CAS authentication failed. Please try again later.' });
    }
  }

  @Get('login/openid')
  async openidLogin(@Req() req: Request, @Res() res: Response) {
    const methods = this.authMethods();
    if (!methods.includes('openid')) {
      return res.status(404).render('security/error', { error: 'OpenID authentication is not enabled.' });
    }

    const authorizeEndpoint = this.configService.get<string>('OIDC_AUTHORIZATION_ENDPOINT');
    if (!authorizeEndpoint) {
      return res.status(500).render('security/error', { error: 'OpenID Connect is misconfigured.' });
    }

    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    const codeVerifier = randomBytes(32).toString('hex');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const redirectUri = buildAbsoluteUrl(req, '/login/openid/callback');
    const scope = this.configService.get<string>('OIDC_SCOPE') || 'openid email';

    if ((req as any).session) {
      (req as any).session.authMethodUsed = 'oidc';
      (req as any).session.oidcState = state;
      (req as any).session.oidcNonce = nonce;
      (req as any).session.oidcCodeVerifier = codeVerifier;
    }

    const params = new URLSearchParams({
      client_id: this.configService.get<string>('OIDC_CLIENT_ID') || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'consent',
    });

    return res.redirect(`${authorizeEndpoint}?${params.toString()}`);
  }

  @Get('login/openid/callback')
  async openidCallback(@Req() req: Request, @Res() res: Response, @Query() query: Record<string, string>) {
    const methods = this.authMethods();
    if (!methods.includes('openid')) {
      return res.status(404).render('security/error', { error: 'OpenID authentication is not enabled.' });
    }

    if (query.error) {
      return res.status(400).render('security/error', { error: query.error_description || query.error });
    }

    if ((req as any).session?.oidcState && query.state !== (req as any).session.oidcState) {
      return res.status(400).render('security/error', { error: 'Invalid OpenID Connect state.' });
    }

    const tokenEndpoint = this.configService.get<string>('OIDC_TOKEN_ENDPOINT');
    if (!tokenEndpoint) {
      return res.status(500).render('security/error', { error: 'OpenID Connect is misconfigured.' });
    }

    const fetchFn = (global as any).fetch;
    if (!fetchFn) {
      return res.status(500).render('security/error', { error: 'Fetch API is not available to perform OpenID Connect flow.' });
    }

    try {
      const redirectUri = buildAbsoluteUrl(req, '/login/openid/callback');
      const tokenResponse = await fetchFn(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.configService.get<string>('OIDC_CLIENT_ID') || '',
          client_secret: this.configService.get<string>('OIDC_CLIENT_SECRET') || '',
          redirect_uri: redirectUri,
          code: query.code || '',
          code_verifier: (req as any).session?.oidcCodeVerifier || '',
        }),
      });

      const tokenJson = await tokenResponse.json();
      const accessToken = tokenJson.access_token as string | undefined;
      const idToken = tokenJson.id_token as string | undefined;

      if ((req as any).session) {
        (req as any).session.oidcAccessToken = accessToken;
        (req as any).session.oidcIdToken = idToken;
      }

      let userEmail: string | undefined;
      let subject: string | undefined;
      const idPayload = decodeJwtPayload(idToken);
      if (idPayload) {
        userEmail = idPayload.email || idPayload.preferred_username;
        subject = idPayload.sub;
      }

      if (!userEmail && accessToken) {
        const userinfoEndpoint = this.configService.get<string>('OIDC_USERINFO_ENDPOINT');
        if (userinfoEndpoint) {
          try {
            const userinfoResponse = await fetchFn(userinfoEndpoint, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const userinfo = await userinfoResponse.json();
            userEmail = userinfo.email || userinfo.preferred_username;
            subject = userinfo.sub || subject;
          } catch (userinfoError) {
            console.warn('Failed to load userinfo:', userinfoError);
          }
        }
      }

      const identifier = `oidc:${subject || userEmail || 'user'}`;
      const user = await this.authService.findOrCreateExternalUser(identifier, userEmail);

      if ((req as any).session) {
        (req as any).session.userId = user.id;
        (req as any).session.email = user.email;
        (req as any).session.authMethodUsed = 'oidc';
        (req as any).session.isGuest = false;
      }

      const redirectTarget = this.targetAfterLogin(req);
      const redirectUrl = this.appendAccessToken(redirectTarget, accessToken || idToken);

      if ((req as any).session) {
        delete (req as any).session.oidcState;
        delete (req as any).session.oidcCodeVerifier;
      }

      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('OpenID authentication error:', error);
      return res.status(500).render('security/error', { error: 'OpenID authentication failed. Please try again later.' });
    }
  }

  @Get('logout/redirect')
  async logoutRedirect(@Req() req: Request, @Res() res: Response) {
    const method = (req as any).session?.authMethodUsed;
    const idToken = (req as any).session?.oidcIdToken;
    const accessToken = (req as any).session?.oidcAccessToken;
    const fetchFn = (global as any).fetch;
    let redirectUrl: string | null = null;

    try {
      if (method === 'cas') {
        const casUrl = (this.configService.get<string>('CAS_URL') || '').replace(/\/$/, '');
        const casLogoutPath = (this.configService.get<string>('CAS_LOGOUT_PATH') || '/logout').replace(/^\//, '');
        if (casUrl && casLogoutPath) {
          const service = buildAbsoluteUrl(req, '/login');
          redirectUrl = `${casUrl}/${casLogoutPath}?service=${encodeURIComponent(service)}`;
        }
      } else if (method === 'oidc') {
        const issuer = this.configService.get<string>('OIDC_ISSUER') || '';
        const discoveryUrl = issuer ? `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration` : '';
        if (discoveryUrl && fetchFn) {
          try {
            const discoveryResponse = await fetchFn(discoveryUrl);
            const discovery = await discoveryResponse.json();
            const endSession = discovery.end_session_endpoint;
            if (endSession) {
              const params = new URLSearchParams({
                post_logout_redirect_uri: buildAbsoluteUrl(req, '/login'),
              });
              if (idToken) {
                params.append('id_token_hint', idToken);
              }
              const clientId = this.configService.get<string>('OIDC_CLIENT_ID');
              if (clientId) {
                params.append('client_id', clientId);
              }
              redirectUrl = `${endSession}?${params.toString()}`;
            }
          } catch (dsError) {
            console.warn('OIDC discovery failed during logout:', dsError);
          }
        }

        if (!redirectUrl && issuer.includes('accounts.google.com') && accessToken && fetchFn) {
          try {
            await fetchFn('https://oauth2.googleapis.com/revoke', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ token: accessToken }),
            });
          } catch (revokeError) {
            console.warn('Failed to revoke Google token:', revokeError);
          }
          redirectUrl = '/login';
        }
      }
    } finally {
      if ((req as any).session) {
        (req as any).session.destroy(() => {
          return res.redirect(redirectUrl || '/login');
        });
      } else {
        return res.redirect(redirectUrl || '/login');
      }
    }
  }

  private appendAccessToken(redirectUrl: string, token?: string): string {
    if (!token) return redirectUrl;
    const separator = redirectUrl.includes('?') ? '&' : '?';
    return `${redirectUrl}${separator}access_token=${encodeURIComponent(token)}`;
  }

  // Form-based login endpoints (compatibilidad con Symfony)
  @Post('login_check')
  async loginCheck(
    @Body() body: { email: string; password: string; _csrf_token?: string },
    @Req() req: any,
    @Res() res: Response,
  ) {
    try {
      console.log('Login attempt:', { email: body.email });

      // Validate user credentials against database
      const user = await this.authService.validateUser(body.email, body.password);

      console.log('User validation result:', user ? 'Found' : 'Not found');

      if (!user) {
        console.log('Invalid credentials for:', body.email);
        return res.redirect(302, '/login?error=invalid_credentials');
      }

      // Save user info in session
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.authMethodUsed = 'password';
      req.session.isGuest = false;

      console.log('Login successful for:', body.email);
      return res.redirect(302, this.targetAfterLogin(req));
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error stack:', error.stack);
      return res.redirect(302, '/login?error=server_error');
    }
  }

  @Post('login/guest')
  async guestLogin(
    @Body() body: { guest_login_nonce?: string },
    @Req() req: any,
    @Res() res: Response,
  ) {
    console.log('Guest login attempt');

    if (req.session?.guestLoginNonce && body.guest_login_nonce !== req.session.guestLoginNonce) {
      return res.status(403).render('security/error', { error: 'Invalid guest login request.' });
    }

    // Create temporary guest user ID
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const guestEmail = `${guestId}@guest.local`;

    // Set guest session
    req.session.userId = guestId;
    req.session.email = guestEmail;
    req.session.isGuest = true;
    req.session.authMethodUsed = 'guest';

    console.log('Guest login successful:', guestId);
    return res.redirect(302, this.targetAfterLogin(req));
  }

  @Get('logout')
  async logout(@Req() req: any, @Res() res: Response) {
    // Defer cleanup to logout/redirect to preserve provider tokens
    if (req.session) {
      req.session.postLogoutRedirect = req.session.postLogoutRedirect || '/login';
    }

    return res.redirect(302, '/logout/redirect');
  }
}
