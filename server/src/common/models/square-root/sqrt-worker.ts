import path from "node:path";
import { Worker } from "node:worker_threads";

type WorkerSuccessMessage = {
	success: true;
	result: number;
};

type WorkerFailureMessage = {
	success: false;
	error: string;
};

type WorkerMessage = WorkerSuccessMessage | WorkerFailureMessage;

function resolveWorkerPath(): string {
	const extension = __filename.endsWith(".ts") ? "ts" : "js";
	return path.resolve(__dirname, `../../../workers/sqrt-calculation.worker.${extension}`);
}

export function calculateSqrtInWorker(input: number): Promise<number> {
	return new Promise((resolve, reject) => {
		const isTypescriptRuntime = __filename.endsWith(".ts");
		const worker = new Worker(resolveWorkerPath(), {
			workerData: { input },
			execArgv: isTypescriptRuntime ? ["--require", "tsx/cjs"] : undefined,
		});

		let settled = false;

		const fail = (error: Error) => {
			if (settled) return;
			settled = true;
			void worker.terminate().finally(() => reject(error));
		};

		worker.once("message", (message: WorkerMessage) => {
			if (settled) return;
			settled = true;

			if (message.success) {
				void worker.terminate().finally(() => resolve(message.result));
				return;
			}

			void worker.terminate().finally(() => reject(new Error(message.error)));
		});

		worker.once("error", fail);
		worker.once("exit", (code) => {
			if (!settled && code !== 0) {
				fail(new Error(`Square-root worker stopped with exit code ${code}`));
			}
		});
	});
}
