import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { QuestionsOptionsService } from './questions_options.service';
import { CreateQuestionsOptionDto } from './dto/create-questions_option.dto';
import { UpdateQuestionsOptionDto } from './dto/update-questions_option.dto';

@Controller('questions-options')
export class QuestionsOptionsController {
  constructor(private readonly questionsOptionsService: QuestionsOptionsService) {}

  @Post()
  create(@Body() createQuestionsOptionDto: CreateQuestionsOptionDto) {
    return this.questionsOptionsService.create(createQuestionsOptionDto);
  }

  @Get()
  findAll() {
    return this.questionsOptionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionsOptionsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateQuestionsOptionDto: UpdateQuestionsOptionDto) {
    return this.questionsOptionsService.update(+id, updateQuestionsOptionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionsOptionsService.remove(+id);
  }
}
