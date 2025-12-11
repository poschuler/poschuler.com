import type { D1Database, D1Result } from '@cloudflare/workers-types';

function getStatement(db: D1Database, sql: string, values: any[] | null) {
    const valuesArray = values || [];

    const cleanedValues = valuesArray.map(val => val);

    return db.prepare(sql).bind(...cleanedValues);
}

export const dbQueryRow = async <T = any>(
    db: D1Database,
    sql: string,
    values: any[] | null
): Promise<T | undefined> => {
    let start = Date.now();

    try {
        const statement = getStatement(db, sql, values);

        // Use .first() to fetch a single row object
        let res = await statement.first<T | null>();

        // if (debugDatabase) {
        //     let duration = Date.now() - start;
        //     console.log("D1 Row result", { duration, row: res ? 1 : 0 });
        // }

        if (res === null) {
            return undefined;
        }

        return res;
    } catch (e) {
        console.error("D1 dbQueryRow Failed:", e);
        throw e;
    }
    // D1 does not require connection release, so the 'finally' block is removed.
};

export const dbQuery = async <T = any>(
    db: D1Database,
    sql: string,
    values: any[] | null
): Promise<T[]> => {
    let start = Date.now();

    try {
        const statement = getStatement(db, sql, values);

        // Use .all() to fetch multiple rows
        let res: D1Result = await statement.all<T>();

        // if (debugDatabase) {
        //     let duration = Date.now() - start;
        //     console.log("D1 Query result", { duration, rows: res.results?.length ?? 0 });
        // }

        return (res.results || []) as T[];
    } catch (e) {
        console.error("D1 dbQuery Failed:", e);
        throw e;
    }
};

export const dbExecute = async (
    db: D1Database,
    sql: string,
    values: any[] | null
): Promise<D1Result> => {
    let start = Date.now();

    try {
        const statement = getStatement(db, sql, values);

        let res: D1Result = await statement.run();

        return res;
    } catch (e) {
        console.error("D1 dbExecute Failed:", e);
        throw e;
    }
};