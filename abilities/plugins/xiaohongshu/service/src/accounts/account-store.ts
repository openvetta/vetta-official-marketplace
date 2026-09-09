import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface AccountMetadata {
	id: string;
	name: string;
	username?: string;
	userId?: string;
	avatarUrl?: string;
	createdAt: string;
	updatedAt: string;
}

export interface AccountStore {
	list(): Promise<AccountMetadata[]>;
	get(id: string): Promise<AccountMetadata | undefined>;
	upsert(account: AccountMetadata): Promise<void>;
	remove(id: string): Promise<void>;
	storagePath(id: string): string;
}

function safeId(id: string): string {
	if (!/^[a-z0-9][a-z0-9-]{1,63}$/u.test(id)) throw new Error("Invalid account id");
	return id;
}

export function createAccountStore(root: string): AccountStore {
	const accountsDirectory = join(root, "accounts");
	const indexPath = join(root, "accounts.json");
	async function readAll(): Promise<AccountMetadata[]> {
		try {
			const value: unknown = JSON.parse(await readFile(indexPath, "utf8"));
			return Array.isArray(value) ? value.filter((item): item is AccountMetadata => Boolean(item && typeof item === "object" && typeof (item as AccountMetadata).id === "string")) : [];
		} catch {
			return [];
		}
	}
	async function saveAll(accounts: AccountMetadata[]): Promise<void> {
		await mkdir(root, { recursive: true });
		const temporary = `${indexPath}.tmp-${process.pid}`;
		await writeFile(temporary, JSON.stringify(accounts, null, 2), { mode: 0o600 });
		await rename(temporary, indexPath);
	}
	return {
		list: readAll,
		get: async (id) => (await readAll()).find((account) => account.id === id),
		upsert: async (account) => {
			safeId(account.id);
			const accounts = await readAll();
			const index = accounts.findIndex((item) => item.id === account.id);
			if (index === -1) accounts.push(account);
			else accounts[index] = account;
			await mkdir(join(accountsDirectory, account.id), { recursive: true, mode: 0o700 });
			await saveAll(accounts);
		},
		remove: async (id) => {
			const accounts = await readAll();
			await saveAll(accounts.filter((account) => account.id !== id));
			await rm(join(accountsDirectory, safeId(id)), { recursive: true, force: true });
		},
		storagePath: (id) => join(accountsDirectory, safeId(id), "storage-state.json"),
	};
}
