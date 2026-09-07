import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Enable CORS
  app.enableCors();

  // Global prefix for API routes
  app.setGlobalPrefix("api");

  await app.listen(3000);
  console.log("app is running on port 3000");
}
bootstrap();
