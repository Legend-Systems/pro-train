import { Injectable } from '@nestjs/common';
import { CreateQuestionsOptionDto } from './dto/create-questions_option.dto';
import { UpdateQuestionsOptionDto } from './dto/update-questions_option.dto';

@Injectable()
export class QuestionsOptionsService {
  create(createQuestionsOptionDto: CreateQuestionsOptionDto) {
    return 'This action adds a new questionsOption';
  }

  findAll() {
    return `This action returns all questionsOptions`;
  }

  findOne(id: number) {
    return `This action returns a #${id} questionsOption`;
  }

  update(id: number, updateQuestionsOptionDto: UpdateQuestionsOptionDto) {
    return `This action updates a #${id} questionsOption`;
  }

  remove(id: number) {
    return `This action removes a #${id} questionsOption`;
  }
}
