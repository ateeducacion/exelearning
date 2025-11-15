import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserSummary } from './entities/user.entity';

@Controller({ path: 'users', version: '2' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(): Promise<UserSummary[]> {
    return this.usersService.list();
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<UserSummary | null> {
    return this.usersService.findOne(id);
  }

  @Post()
  async create(@Body() payload: CreateUserDto): Promise<UserSummary> {
    return this.usersService.create(payload);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateUserDto
  ): Promise<UserSummary> {
    return this.usersService.update(id, payload);
  }
}
