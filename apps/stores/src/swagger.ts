import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function isSwaggerEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (environment.ENABLE_API_DOCS === "true") {
    return true;
  }
  if (environment.ENABLE_API_DOCS === "false") {
    return false;
  }
  return environment.NODE_ENV !== "production";
}

export function setupStoresSwagger(app: INestApplication): void {
  if (!isSwaggerEnabled()) {
    return;
  }
  const config = new DocumentBuilder()
    .setTitle("Stores API")
    .setDescription("Store CRUD operations used by the Giftcards service.")
    .setVersion("1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);
}
