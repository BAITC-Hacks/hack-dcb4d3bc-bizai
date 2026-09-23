import "server-only";
import { SqliteRepository } from "./database";

const globalStore = globalThis as typeof globalThis & { careerRepository?: SqliteRepository };
export function repository() {
  return globalStore.careerRepository ??= new SqliteRepository(process.env.DATABASE_PATH ?? ".data/career-quest.sqlite");
}
