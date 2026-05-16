import type { Request } from "express";
import { rateLimit } from "express-rate-limit";
import { StatusCodes } from "http-status-codes";

import { ServiceResponse } from "@/common/models/serviceResponse";
import { env } from "@/common/utils/envConfig";
import { handleServiceResponse } from "@/common/utils/httpHandlers";

const tooManyRequestsMessage = "Too many requests, please try again later.";

const rateLimiter = rateLimit({
	handler: (_req, res) =>
		handleServiceResponse(ServiceResponse.failure(tooManyRequestsMessage, null, StatusCodes.TOO_MANY_REQUESTS), res),
	legacyHeaders: true,
	limit: env.COMMON_RATE_LIMIT_MAX_REQUESTS,
	standardHeaders: true,
	windowMs: 15 * 60 * env.COMMON_RATE_LIMIT_WINDOW_MS,
	keyGenerator: (req: Request) => req.ip as string,
});

export default rateLimiter;
