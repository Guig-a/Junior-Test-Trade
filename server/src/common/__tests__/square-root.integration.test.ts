import { StatusCodes } from "http-status-codes";
import request from "supertest";

import { prisma } from "@/common/database/prisma";
import { app } from "@/server";

describe("Square root routes", () => {
	beforeEach(async () => {
		await prisma.calculation.deleteMany({});
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	describe("POST /square-root/calculate", () => {
		it("calculates and persists a valid input", async () => {
			const response = await request(app).post("/square-root/calculate").send({ input: 16 });

			expect(response.status).toBe(StatusCodes.OK);
			expect(response.body.success).toBe(true);
			expect(response.body.responseObject).toMatchObject({
				input: 16,
				result: expect.closeTo(4, 7),
			});
			expect(typeof response.body.responseObject.id).toBe("string");
			expect(typeof response.body.responseObject.createdAt).toBe("string");

			const count = await prisma.calculation.count();
			expect(count).toBe(1);
		});

		it("rejects invalid input without persisting", async () => {
			const response = await request(app).post("/square-root/calculate").send({ input: "16" });

			expect(response.status).toBe(StatusCodes.BAD_REQUEST);
			expect(response.body.success).toBe(false);

			const count = await prisma.calculation.count();
			expect(count).toBe(0);
		});
	});

	describe("GET/DELETE /square-root/history", () => {
		it("returns cursor-paginated history and clears all records", async () => {
			await request(app).post("/square-root/calculate").send({ input: 4 });
			await request(app).post("/square-root/calculate").send({ input: 9 });
			await request(app).post("/square-root/calculate").send({ input: 16 });

			const firstPage = await request(app).get("/square-root/history?limit=2");

			expect(firstPage.status).toBe(StatusCodes.OK);
			expect(firstPage.body.success).toBe(true);
			expect(firstPage.body.responseObject.items).toHaveLength(2);
			expect(typeof firstPage.body.responseObject.nextCursor).toBe("string");

			const nextCursor = firstPage.body.responseObject.nextCursor;
			const secondPage = await request(app).get(`/square-root/history?limit=2&cursor=${nextCursor}`);

			expect(secondPage.status).toBe(StatusCodes.OK);
			expect(secondPage.body.responseObject.items).toHaveLength(1);
			expect(secondPage.body.responseObject.nextCursor).toBeUndefined();

			const deleteResponse = await request(app).delete("/square-root/history");
			expect(deleteResponse.status).toBe(StatusCodes.OK);
			expect(deleteResponse.body.success).toBe(true);

			const emptyHistory = await request(app).get("/square-root/history?limit=10");
			expect(emptyHistory.body.responseObject.items).toHaveLength(0);
		});
	});
});
