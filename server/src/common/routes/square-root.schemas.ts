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
