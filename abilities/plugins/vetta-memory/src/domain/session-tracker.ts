export interface Exchange {
    user: string;
    assistant: string | null;
}

const MAX_SESSIONS = 50;
const MAX_EXCHANGES = 12;
const MAX_USER = 1200;
const MAX_ASSISTANT = 1200;

interface Pending {
    prompt: string | null;
    exchanges: Exchange[];
}

/**
 * Remembers each session's recent prompt/reply pairs. Hook events only carry
 * one side at a time, and the host does not give plugins the transcript, so
 * this buffer is what extraction and the end-of-session summary work from.
 */
export class SessionTracker {
    private readonly sessions = new Map<string, Pending>();

    private entry(sessionId: string): Pending {
        let pending = this.sessions.get(sessionId);
        if (pending) {
            this.sessions.delete(sessionId);
        } else {
            pending = { prompt: null, exchanges: [] };
        }
        this.sessions.set(sessionId, pending);
        while (this.sessions.size > MAX_SESSIONS) {
            const oldest = this.sessions.keys().next().value;
            if (oldest === undefined) break;
            this.sessions.delete(oldest);
        }
        return pending;
    }

    recordPrompt(sessionId: string, prompt: string): void {
        this.entry(sessionId).prompt = prompt.slice(0, MAX_USER);
    }

    /** Completes the pending prompt with the reply and returns the finished exchange, if any. */
    recordReply(sessionId: string, reply: string | null): Exchange | null {
        const pending = this.entry(sessionId);
        if (pending.prompt === null) return null;
        const exchange: Exchange = { user: pending.prompt, assistant: reply ? reply.slice(0, MAX_ASSISTANT) : null };
        pending.prompt = null;
        pending.exchanges.push(exchange);
        if (pending.exchanges.length > MAX_EXCHANGES) pending.exchanges.shift();
        return exchange;
    }

    exchanges(sessionId: string): readonly Exchange[] {
        return this.sessions.get(sessionId)?.exchanges ?? [];
    }

    /** Returns the buffered exchanges and forgets the session. */
    take(sessionId: string): Exchange[] {
        const exchanges = this.sessions.get(sessionId)?.exchanges ?? [];
        this.sessions.delete(sessionId);
        return [...exchanges];
    }
}
