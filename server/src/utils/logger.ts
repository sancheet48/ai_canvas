export interface ErrorLog {
  message: string;
  timestamp: number;
}

export const errorHistory: ErrorLog[] = [];

export function logError(err: any) {
  let message = '';
  if (err instanceof Error) {
    message = err.stack || err.message;
  } else if (typeof err === 'object') {
    message = JSON.stringify(err);
  } else {
    message = String(err);
  }

  errorHistory.push({
    message,
    timestamp: Date.now()
  });

  if (errorHistory.length > 50) {
    errorHistory.shift();
  }

  console.error('[SYSTEM ERROR]', message);
}
