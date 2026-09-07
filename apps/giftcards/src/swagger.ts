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

export function setupGiftcardsSwagger(app: INestApplication): void {
  if (!isSwaggerEnabled()) {
    return;
  }
  const config = new DocumentBuilder()
    .setTitle("Giftcards API")
    .setDescription(
      "Giftcard issuance, pagination, spending, and balance summaries. Amounts are integer cents.",
    )
    .setVersion("1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);
}
