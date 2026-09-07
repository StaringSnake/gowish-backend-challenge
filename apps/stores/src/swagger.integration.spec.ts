import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { DatabaseService } from "@app/database";
import { AppModule } from "./app.module";
import { isSwaggerEnabled, setupStoresSwagger } from "./swagger";

describe("Stores Swagger integration", () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: DatabaseService;

  beforeAll(async () => {
    const databasePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "stores-swagger-")),
      "app.db",
    );
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.ENABLE_API_DOCS = "true";
    app = await NestFactory.create(AppModule);
    app.useGlobalPipes(new ValidationPipe());
    app.setGlobalPrefix("api");
    setupStoresSwagger(app);
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

  it("serves the UI and documents all Stores CRUD inputs", async () => {
    const ui = await fetch(`${baseUrl}/api/docs`);
    expect(ui.status).toBe(200);
    expect(await ui.text()).toContain("Swagger UI");

    const response = await fetch(`${baseUrl}/api/docs-json`);
    expect(response.status).toBe(200);
    const document = await response.json();
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(["/api/stores", "/api/stores/{id}"]),
    );
    expect(document.paths["/api/stores"].post.requestBody).toBeDefined();
    expect(document.paths["/api/stores/{id}"].patch.requestBody).toBeDefined();
    expect(
      document.components.schemas.CreateStoreDto.properties.countryCode,
    ).toMatchObject({
      minLength: 2,
      maxLength: 2,
    });
    expect(document.components.schemas.UpdateStoreDto.required ?? []).toEqual(
      [],
    );
    expect(document.components.schemas.UpdateStoreDto.properties).toEqual(
      expect.objectContaining({
        name: expect.any(Object),
        countryCode: expect.any(Object),
        address: expect.any(Object),
      }),
    );
  });

  it("defaults docs on outside production and requires an explicit production flag", () => {
    expect(isSwaggerEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(
      isSwaggerEnabled({ NODE_ENV: "production", ENABLE_API_DOCS: "true" }),
    ).toBe(true);
  });
});
