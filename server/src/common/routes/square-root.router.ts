import { Router, type Request, type Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { SqrtCalculationRequest, SqrtCalculationResponse, SqrtHistoryResponse } from "@shared/types";

import { prisma } from "@/common/database/prisma";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { calculateSqrtInWorker } from "@/common/models/square-root/sqrt-worker";
import { calculateRequestSchema, historyRequestSchema } from "@/common/routes/square-root.schemas";
import { handleServiceResponse, validateRequest } from "@/common/utils/httpHandlers";

export const squareRootRouter = Router();

function mapCalculationToResponse(calculation: {
	id: number;
	input: number;
	result: number;
	createdAt: Date;
}): SqrtCalculationResponse {
	return {
		id: String(calculation.id),
		input: calculation.input,
		result: calculation.result,
		createdAt: calculation.createdAt.toISOString(),
	};
}

squareRootRouter.post("/calculate", validateRequest(calculateRequestSchema), async (req: Request, res: Response) => {
	const { input } = req.body as SqrtCalculationRequest;

	try {
		const result = await calculateSqrtInWorker(input);
		const calculation = await prisma.calculation.create({
			data: {
				input,
				result,
			},
		});
		const responseObject = mapCalculationToResponse(calculation);

		return handleServiceResponse(
			ServiceResponse.success("Square root calculated successfully", responseObject, StatusCodes.OK),
			res,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to calculate square root";
		return handleServiceResponse(ServiceResponse.failure(message, null, StatusCodes.INTERNAL_SERVER_ERROR), res);
	}
});

squareRootRouter.get("/history", validateRequest(historyRequestSchema), async (req: Request, res: Response) => {
	const { limit, cursor } = historyRequestSchema.parse({ query: req.query }).query;
	const cursorId = cursor === undefined ? undefined : Number(cursor);

	const calculations = await prisma.calculation.findMany({
		...(cursorId !== undefined ? { cursor: { id: cursorId }, skip: 1 } : {}),
		orderBy: { id: "desc" },
		take: limit + 1,
	});

	const hasNextPage = calculations.length > limit;
	const pageItems = calculations.slice(0, limit);
	const responseObject: SqrtHistoryResponse = {
		items: pageItems.map(mapCalculationToResponse),
		...(hasNextPage && pageItems.length > 0 ? { nextCursor: String(pageItems[pageItems.length - 1].id) } : {}),
	};

	return handleServiceResponse(
		ServiceResponse.success("Square root history retrieved successfully", responseObject, StatusCodes.OK),
		res,
	);
});

squareRootRouter.delete("/history", async (_req: Request, res: Response) => {
	await prisma.calculation.deleteMany({});

	return handleServiceResponse(
		ServiceResponse.success("Square root history cleared successfully", null, StatusCodes.OK),
		res,
	);
});
