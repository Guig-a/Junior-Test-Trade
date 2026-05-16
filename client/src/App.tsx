import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { SqrtCalculationRequest, SqrtCalculationResponse, SqrtHistoryResponse } from "@shared/types";
import "./App.css";

type ServiceResponse<T> = {
	success: boolean;
	message: string;
	responseObject: T;
	statusCode: number;
};

const historyLimit = 10;

async function parseServiceResponse<T>(response: Response): Promise<T> {
	const body = (await response.json()) as ServiceResponse<T>;

	if (!response.ok || !body.success) {
		throw new Error(body.message || "Request failed");
	}

	return body.responseObject;
}

function App() {
	const [input, setInput] = useState("");
	const [latestCalculation, setLatestCalculation] = useState<SqrtCalculationResponse | null>(null);
	const [history, setHistory] = useState<SqrtCalculationResponse[]>([]);
	const [currentCursor, setCurrentCursor] = useState<string | undefined>();
	const [previousCursors, setPreviousCursors] = useState<(string | undefined)[]>([]);
	const [nextCursor, setNextCursor] = useState<string | undefined>();
	const [isCalculating, setIsCalculating] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadHistory = useCallback(async (cursor?: string) => {
		setIsLoadingHistory(true);
		setError(null);

		try {
			const params = new URLSearchParams({ limit: String(historyLimit) });
			if (cursor) params.set("cursor", cursor);

			const response = await fetch(`/square-root/history?${params.toString()}`);
			const payload = await parseServiceResponse<SqrtHistoryResponse>(response);
			setHistory(payload.items);
			setNextCursor(payload.nextCursor);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load history");
		} finally {
			setIsLoadingHistory(false);
		}
	}, []);

	useEffect(() => {
		let ignore = false;

		async function loadInitialHistory() {
			try {
				const response = await fetch(`/square-root/history?limit=${historyLimit}`);
				const payload = await parseServiceResponse<SqrtHistoryResponse>(response);

				if (!ignore) {
					setHistory(payload.items);
					setNextCursor(payload.nextCursor);
				}
			} catch (err) {
				if (!ignore) {
					setError(err instanceof Error ? err.message : "Failed to load history");
				}
			}
		}

		void loadInitialHistory();

		return () => {
			ignore = true;
		};
	}, []);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		const parsedInput = Number(input);
		if (!Number.isFinite(parsedInput)) {
			setError("Enter a finite number.");
			return;
		}

		setIsCalculating(true);

		try {
			const requestBody: SqrtCalculationRequest = { input: parsedInput };
			const response = await fetch("/square-root/calculate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			});
			const calculation = await parseServiceResponse<SqrtCalculationResponse>(response);

			setLatestCalculation(calculation);
			setInput("");
			setCurrentCursor(undefined);
			setPreviousCursors([]);
			await loadHistory();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to calculate square root");
		} finally {
			setIsCalculating(false);
		}
	};

	const goToNextPage = async () => {
		if (!nextCursor) return;

		setPreviousCursors((cursors) => [...cursors, currentCursor]);
		setCurrentCursor(nextCursor);
		await loadHistory(nextCursor);
	};

	const goToPreviousPage = async () => {
		const previousCursor = previousCursors.at(-1);
		const remainingCursors = previousCursors.slice(0, -1);

		setPreviousCursors(remainingCursors);
		setCurrentCursor(previousCursor);
		await loadHistory(previousCursor);
	};

	const clearHistory = async () => {
		setError(null);
		setIsLoadingHistory(true);

		try {
			const response = await fetch("/square-root/history", { method: "DELETE" });
			await parseServiceResponse<null>(response);
			setHistory([]);
			setLatestCalculation(null);
			setCurrentCursor(undefined);
			setPreviousCursors([]);
			setNextCursor(undefined);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to clear history");
		} finally {
			setIsLoadingHistory(false);
		}
	};

	return (
		<main className="app">
			<section className="hero">
				<p className="eyebrow">Newton-Raphson + Express + SQLite</p>
				<h1>Square root calculator</h1>
				<p className="hint">Submit a number, calculate its square root off the API main thread, and review persisted history.</p>
			</section>

			<section className="panel" aria-labelledby="calculator-heading">
				<h2 id="calculator-heading">Calculate</h2>
				<form className="calculator-form" onSubmit={handleSubmit}>
					<label htmlFor="input">Number</label>
					<div className="input-row">
						<input
							id="input"
							inputMode="decimal"
							name="input"
							onChange={(event) => setInput(event.target.value)}
							placeholder="e.g. 16"
							type="number"
							value={input}
						/>
						<button disabled={isCalculating || input.trim() === ""} type="submit">
							{isCalculating ? "Calculating..." : "Calculate"}
						</button>
					</div>
				</form>

				{error ? <p className="error">{error}</p> : null}

				{latestCalculation ? (
					<div className="result" aria-live="polite">
						<span>Latest result</span>
						<strong>
							√{latestCalculation.input} = {latestCalculation.result}
						</strong>
					</div>
				) : null}
			</section>

			<section className="panel" aria-labelledby="history-heading">
				<div className="section-header">
					<div>
						<h2 id="history-heading">History</h2>
						<p className="muted">Showing up to {historyLimit} calculations per page.</p>
					</div>
					<button className="secondary danger" disabled={isLoadingHistory || history.length === 0} onClick={clearHistory} type="button">
						Clear history
					</button>
				</div>

				{isLoadingHistory ? <p className="muted">Loading history...</p> : null}

				<div className="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Input</th>
								<th>Result</th>
								<th>Created at</th>
							</tr>
						</thead>
						<tbody>
							{history.length > 0 ? (
								history.map((item) => (
									<tr key={item.id}>
										<td>{item.input}</td>
										<td>{item.result}</td>
										<td>{new Date(item.createdAt).toLocaleString()}</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan={3}>No calculations yet.</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				<div className="pagination">
					<button className="secondary" disabled={isLoadingHistory || previousCursors.length === 0} onClick={goToPreviousPage} type="button">
						Previous
					</button>
					<button className="secondary" disabled={isLoadingHistory || !nextCursor} onClick={goToNextPage} type="button">
						Next
					</button>
				</div>
			</section>
		</main>
	);
}

export default App;
