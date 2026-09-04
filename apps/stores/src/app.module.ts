import { Module } from "@nestjs/common";
import { DatabaseModule } from "@app/database";
import { StoresModule } from "./stores";

@Module({
  imports: [DatabaseModule, StoresModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
