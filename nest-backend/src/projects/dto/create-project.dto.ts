import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  ownerId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pageCount?: number;
}
