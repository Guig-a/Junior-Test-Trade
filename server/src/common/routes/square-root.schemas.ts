import { z } from "zod";

export const calculateRequestSchema = z.object({
	body: z.object({
		input: z
			.number({
				required_error: "input is required",
				invalid_type_error: "input must be a number",
			})
			.finite("input must be finite"),
	}),
});

export const historyRequestSchema = z.object({
	query: z.object({
		limit: z
			.string()
			.optional()
			.default("10")
			.transform((value) => Number(value))
			.pipe(z.number().int("limit must be an integer").min(1).max(100)),
		cursor: z
			.string()
			.optional()
			.refine((value) => value === undefined || Number.isInteger(Number(value)), {
				message: "cursor must be a valid calculation id",
			}),
	}),
});
