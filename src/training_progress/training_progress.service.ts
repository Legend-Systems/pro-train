import { Injectable } from '@nestjs/common';
import { CreateTrainingProgressDto } from './dto/create-training_progress.dto';
import { UpdateTrainingProgressDto } from './dto/update-training_progress.dto';

@Injectable()
export class TrainingProgressService {
  create(createTrainingProgressDto: CreateTrainingProgressDto) {
    return 'This action adds a new trainingProgress';
  }

  findAll() {
    return `This action returns all trainingProgress`;
  }

  findOne(id: number) {
    return `This action returns a #${id} trainingProgress`;
  }

  update(id: number, updateTrainingProgressDto: UpdateTrainingProgressDto) {
    return `This action updates a #${id} trainingProgress`;
  }

  remove(id: number) {
    return `This action removes a #${id} trainingProgress`;
  }
}
