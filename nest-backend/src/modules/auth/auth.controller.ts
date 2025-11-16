import { Controller, Post, Body, Get, Req, UseGuards, Redirect, Res, Put, Param } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
        api_odes_last_updated: {
          path: '/api/ode-management/odes/{odeId}/last-updated',
          methods: ['GET']
        },
        api_odes_ode_save_manual: {
          path: '/api/ode-management/odes/ode/save/manual',
          methods: ['POST']
        },
        api_odes_ode_save_auto: {
          path: '/api/ode-management/odes/ode/save/auto',
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
    // Return user preferences with advanced mode enabled
    // TODO: Implement real user preferences from database
    return {
      userPreferences: {
        advancedMode: { value: 'true' },  // Enable advanced mode to show all menu items
        versionControl: { value: 'false' },
        locale: { value: 'en' }
      }
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

      console.log('Login successful for:', body.email);
      return res.redirect(302, '/workarea');
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

    // Create temporary guest user ID
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const guestEmail = `${guestId}@guest.local`;

    // Set guest session
    req.session.userId = guestId;
    req.session.email = guestEmail;
    req.session.isGuest = true;

    console.log('Guest login successful:', guestId);
    return res.redirect(302, '/workarea');
  }

  @Get('logout')
  async logout(@Req() req: any, @Res() res: Response) {
    // Clear session
    req.session.destroy((err: any) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      return res.redirect(302, '/login');
    });
  }
}