import { Router, type Request, type Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { SqrtCalculationRequest, SqrtCalculationResponse } from "@shared/types";

import { prisma } from "@/common/database/prisma";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { calculateSqrtInWorker } from "@/common/models/square-root/sqrt-worker";
import { calculateRequestSchema } from "@/common/routes/square-root.schemas";
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

squareRootRouter.post(
	"/calculate",
	validateRequest(calculateRequestSchema),
	async (req: Request, res: Response) => {
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
	},
);
