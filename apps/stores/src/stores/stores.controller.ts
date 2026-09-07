import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { StoresService } from "./stores.service";
import { CreateStoreDto } from "./dto/create-store.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";

const storeSchema = {
  type: "object",
  properties: {
    id: { type: "string", example: "store-1" },
    name: { type: "string", example: "Example Store" },
    countryCode: { type: "string", minLength: 2, maxLength: 2, example: "US" },
    address: { type: "string", example: "1 Main Street" },
    createdAt: { type: "string", format: "date-time", nullable: true },
    updatedAt: { type: "string", format: "date-time", nullable: true },
  },
};

@Controller("stores")
@ApiTags("Stores")
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @ApiOperation({ summary: "Create a store" })
  @ApiBody({ type: CreateStoreDto })
  @ApiResponse({
    status: 201,
    description: "Store created.",
    schema: storeSchema,
  })
  create(@Body() createStoreDto: CreateStoreDto) {
    return this.storesService.create(createStoreDto);
  }

  @Get()
  @ApiOperation({ summary: "List stores" })
  @ApiResponse({
    status: 200,
    description: "All stores.",
    schema: { type: "array", items: storeSchema },
  })
  findAll() {
    return this.storesService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a store" })
  @ApiParam({ name: "id", type: String, example: "store-1" })
  @ApiResponse({
    status: 200,
    description: "Store details.",
    schema: storeSchema,
  })
  @ApiResponse({ status: 404, description: "Store not found." })
  findOne(@Param("id") id: string) {
    return this.storesService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a store" })
  @ApiParam({ name: "id", type: String, example: "store-1" })
  @ApiBody({ type: UpdateStoreDto })
  @ApiResponse({
    status: 200,
    description: "Updated store.",
    schema: storeSchema,
  })
  @ApiResponse({ status: 404, description: "Store not found." })
  update(@Param("id") id: string, @Body() updateStoreDto: UpdateStoreDto) {
    return this.storesService.update(id, updateStoreDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a store" })
  @ApiParam({ name: "id", type: String, example: "store-1" })
  @ApiResponse({ status: 200, description: "Store deleted." })
  @ApiResponse({ status: 404, description: "Store not found." })
  remove(@Param("id") id: string) {
    return this.storesService.remove(id);
  }
}
