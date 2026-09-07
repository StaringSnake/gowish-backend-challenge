import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { DatabaseService } from "@app/database";
import { AppModule } from "./app.module";
import { isSwaggerEnabled, setupGiftcardsSwagger } from "./swagger";

describe("Giftcards Swagger integration", () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: DatabaseService;

  beforeAll(async () => {
    const databasePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "giftcards-swagger-")),
      "app.db",
    );
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.ENABLE_API_DOCS = "true";
    app = await NestFactory.create(AppModule);
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.setGlobalPrefix("api");
    setupGiftcardsSwagger(app);
    await app.listen(0);
    baseUrl = await app.getUrl();
    database = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
    database.close();
    delete process.env.DATABASE_URL;
    delete process.env.ENABLE_API_DOCS;
  });

  it("serves the UI and documents every giftcard route and key schemas", async () => {
    const ui = await fetch(`${baseUrl}/api/docs`);
    expect(ui.status).toBe(200);
    expect(await ui.text()).toContain("Swagger UI");

    const response = await fetch(`${baseUrl}/api/docs-json`);
    expect(response.status).toBe(200);
    const document = await response.json();
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        "/api/giftcards",
        "/api/giftcards/summary",
        "/api/giftcards/{id}",
        "/api/giftcards/{id}/spend",
      ]),
    );
    expect(document.paths["/api/giftcards"].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "page",
          schema: expect.objectContaining({ default: 1 }),
        }),
        expect.objectContaining({
          name: "limit",
          schema: expect.objectContaining({ default: 20, maximum: 100 }),
        }),
      ]),
    );
    expect(
      document.paths["/api/giftcards/{id}/spend"].post.requestBody,
    ).toBeDefined();
    const queryParameters = document.paths["/api/giftcards"].get.parameters;
    const queryNames = queryParameters.map(
      (parameter: { name: string }) => parameter.name,
    );
    expect(new Set(queryNames).size).toBe(queryNames.length);
    expect(queryNames).toEqual(["userEmail", "page", "limit"]);
    expect(
      queryParameters.find(
        (parameter: { name: string }) => parameter.name === "userEmail",
      ).schema,
    ).toMatchObject({ type: "string" });
    expect(
      queryParameters.find(
        (parameter: { name: string }) => parameter.name === "page",
      ).schema,
    ).toMatchObject({
      type: "integer",
      format: "int64",
      default: 1,
      maximum: 90071992547409,
    });
    expect(
      queryParameters.find(
        (parameter: { name: string }) => parameter.name === "limit",
      ).schema,
    ).toMatchObject({
      type: "integer",
      format: "int32",
      default: 20,
      maximum: 100,
    });
    expect(
      document.components.schemas.CreateGiftcardDto.properties.amount,
    ).toMatchObject({
      type: "integer",
      format: "int64",
      minimum: 1,
    });
    expect(
      document.components.schemas.SpendGiftcardDto.properties.amount,
    ).toMatchObject({
      type: "integer",
      format: "int64",
      minimum: 1,
    });
    expect(
      document.paths["/api/giftcards"].post.responses["201"].content[
        "application/json"
      ].schema.properties,
    ).toEqual(
      expect.objectContaining({
        createdAt: expect.objectContaining({ nullable: true }),
        updatedAt: expect.objectContaining({ nullable: true }),
      }),
    );
    expect(JSON.stringify(document)).toContain("integer cents");
  });

  it("defaults docs on outside production and requires an explicit production flag", () => {
    expect(isSwaggerEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(
      isSwaggerEnabled({ NODE_ENV: "production", ENABLE_API_DOCS: "true" }),
    ).toBe(true);
  });
});
