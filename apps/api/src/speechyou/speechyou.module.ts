import { Module } from "@nestjs/common";
import { SpeechyouController } from "./speechyou.controller";
import { SpeechyouService } from "./speechyou.service";

@Module({ controllers: [SpeechyouController], providers: [SpeechyouService] })
export class SpeechyouModule {}
