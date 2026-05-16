import { parentPort, workerData } from "node:worker_threads";

import { NewtonRaphsonAlgorithm } from "../common/models/square-root/newton-raphson-algorythm.class";
import { SqrtCalculator } from "../common/models/square-root/sqrt-calculator.class";

type WorkerMessage =
	| {
			success: true;
			result: number;
	  }
	| {
			success: false;
			error: string;
	  };

const { input } = workerData as { input: number };

try {
	const result = new SqrtCalculator(input, new NewtonRaphsonAlgorithm()).calculate();
	parentPort?.postMessage({ success: true, result } satisfies WorkerMessage);
} catch (error) {
	const message = error instanceof Error ? error.message : "Failed to calculate square root";
	parentPort?.postMessage({ success: false, error: message } satisfies WorkerMessage);
}
