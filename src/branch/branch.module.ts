import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchService } from './branch.service';
import { BranchController } from './branch.controller';
import { Branch } from './entities/branch.entity';
import { Organization } from '../org/entities/org.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Branch, Organization])],
    controllers: [BranchController],
    providers: [BranchService],
    exports: [BranchService], // Export if needed by other modules
})
export class BranchModule {}
