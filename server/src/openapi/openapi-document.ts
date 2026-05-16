import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { calculateRequestSchema, historyRequestSchema } from "@/common/routes/square-root.schemas";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const calculationSchema = registry.register(
	"SqrtCalculationResponse",
	z.object({
		id: z.string().openapi({ example: "1" }),
		input: z.number().openapi({ example: 16 }),
		result: z.number().openapi({ example: 4 }),
		createdAt: z.string().datetime().openapi({ example: "2026-05-16T15:00:00.000Z" }),
	}),
);

const historySchema = registry.register(
	"SqrtHistoryResponse",
	z.object({
		items: z.array(calculationSchema),
		nextCursor: z.string().optional().openapi({ example: "12" }),
	}),
);

const nullableResponseObjectSchema = z.null().openapi({ description: "DELETE /history returns null here." });

const calculationServiceResponseSchema = registry.register(
	"SqrtCalculationServiceResponse",
	createServiceResponseSchema(calculationSchema),
);

const historyServiceResponseSchema = registry.register(
	"SqrtHistoryServiceResponse",
	createServiceResponseSchema(historySchema),
);

const clearHistoryServiceResponseSchema = registry.register(
	"ClearHistoryServiceResponse",
	createServiceResponseSchema(nullableResponseObjectSchema),
);

const validationErrorSchema = registry.register(
	"ValidationErrorServiceResponse",
	createServiceResponseSchema(z.null()).openapi({
		example: {
			success: false,
			message: "Invalid input: input must be finite",
			responseObject: null,
			statusCode: 400,
		},
	}),
);

registry.registerPath({
	method: "post",
	path: "/square-root/calculate",
	tags: ["Square root"],
	summary: "Calculate a square root",
	description: "Validates a finite numeric input, calculates it in a worker thread, persists it, and returns it.",
	request: {
		body: {
			content: {
				"application/json": {
					schema: calculateRequestSchema.shape.body,
				},
			},
			required: true,
		},
	},
	responses: {
		200: {
			description: "Calculation persisted successfully.",
			content: {
				"application/json": {
					schema: calculationServiceResponseSchema,
				},
			},
		},
		400: {
			description: "Validation error.",
			content: {
				"application/json": {
					schema: validationErrorSchema,
				},
			},
		},
	},
});

registry.registerPath({
	method: "get",
	path: "/square-root/history",
	tags: ["Square root"],
	summary: "List calculation history",
	description: "Returns newest calculations first. `nextCursor` is the last returned `Calculation.id` as a string.",
	request: {
		query: historyRequestSchema.shape.query,
	},
	responses: {
		200: {
			description: "Cursor-paginated calculation history.",
			content: {
				"application/json": {
					schema: historyServiceResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid query parameters.",
			content: {
				"application/json": {
					schema: validationErrorSchema,
				},
			},
		},
	},
});

registry.registerPath({
	method: "delete",
	path: "/square-root/history",
	tags: ["Square root"],
	summary: "Clear calculation history",
	description: "Deletes all persisted calculations.",
	responses: {
		200: {
			description: "History cleared successfully.",
			content: {
				"application/json": {
					schema: clearHistoryServiceResponseSchema,
				},
			},
		},
	},
});

function createServiceResponseSchema<T extends z.ZodTypeAny>(responseObjectSchema: T) {
	return z.object({
		success: z.boolean(),
		message: z.string(),
		responseObject: responseObjectSchema,
		statusCode: z.number(),
	});
}

export function getOpenApiDocument() {
	const generator = new OpenApiGeneratorV3(registry.definitions);

	return generator.generateDocument({
		openapi: "3.0.0",
		info: {
			title: "Square Root Calculator API",
			version: "1.0.0",
			description: "Express API for the Junior Fullstack square-root calculator take-home.",
		},
		servers: [{ url: "/" }],
	});
}
