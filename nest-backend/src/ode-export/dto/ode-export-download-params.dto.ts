import { IsIn, IsString, Matches } from 'class-validator';
import { ODE_EXPORT_ALLOWED_TYPES, ODE_SESSION_ID_REGEX, OdeExportType } from '../constants';

export class OdeExportDownloadParamsDto {
  @IsString()
  @Matches(ODE_SESSION_ID_REGEX)
  odeSessionId!: string;

  @IsString()
  @IsIn(ODE_EXPORT_ALLOWED_TYPES)
  exportType!: OdeExportType;
}
