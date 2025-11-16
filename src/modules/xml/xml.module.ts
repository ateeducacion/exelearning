import { Module } from '@nestjs/common';
import { XmlParserService } from './services/xml-parser.service';
import { XmlBuilderService } from './services/xml-builder.service';

@Module({
  providers: [XmlParserService, XmlBuilderService],
  exports: [XmlParserService, XmlBuilderService],
})
export class XmlModule {}
