import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgService } from './org.service';
import { OrgController } from './org.controller';
import { Organization } from './entities/org.entity';
import { Branch } from '../branch/entities/branch.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Organization, Branch])],
    controllers: [OrgController],
    providers: [OrgService],
    exports: [OrgService], // Export if needed by other modules
})
export class OrgModule {}
