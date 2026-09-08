import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { json } from "express";
import "reflect-metadata";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "3mb" }));
  app.enableCors({
    origin: new URL(process.env.WEB_URL || "http://localhost:3000").origin,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const config = new DocumentBuilder()
    .setTitle("AlphaFinance API")
    .setDescription(
      "Local personal finance. Values are integer cents; dates are YYYY-MM-DD. No authentication.",
    )
    .setVersion("1.0")
    .addServer(process.env.API_URL || "http://localhost:8000")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  await app.listen(Number(process.env.API_PORT || 8000), "0.0.0.0");
}
void bootstrap();
