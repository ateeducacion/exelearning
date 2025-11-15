export const ODE_SESSION_ID_REGEX = /^[A-Za-z0-9_-]{3,128}$/;

export const ODE_EXPORT_RELATIVE_PATH_REGEX =
  /^(?:[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)$/;

export const ODE_EXPORT_ALLOWED_TYPES = [
  'elp',
  'html5',
  'html5-sp',
  'scorm12',
  'scorm2004',
  'ims',
  'epub3',
  'properties'
] as const;

export type OdeExportType = (typeof ODE_EXPORT_ALLOWED_TYPES)[number];

export const ODE_EXPORT_PREVIEW_TYPE: OdeExportType = 'html5';
