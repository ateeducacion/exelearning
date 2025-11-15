import { IsString, Matches } from 'class-validator';
import { ODE_SESSION_ID_REGEX } from '../constants';

export class OdeExportPreviewParamsDto {
  @IsString()
  @Matches(ODE_SESSION_ID_REGEX)
  odeSessionId!: string;
}
