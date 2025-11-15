import { IsString, Matches } from 'class-validator';
import { ODE_EXPORT_RELATIVE_PATH_REGEX } from '../constants';

export class OdeExportFileRequestDto {
  @IsString()
  @Matches(ODE_EXPORT_RELATIVE_PATH_REGEX)
  relativePath!: string;
}
