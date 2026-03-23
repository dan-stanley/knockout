import { fetchMatchupsForDate, TOURNAMENT_DAY_DATES } from './matchups';

export interface GameResult {
    teamName: string;
    hasWon: boolean;
    hasLost: boolean;
    status: string;
}

// Fetch all game results for the tournament directly from ESPN API
// This completely bypasses the AWS database, keeping the app fast and always up-to-date
export const fetchLiveResults = async (): Promise<GameResult[]> => {
    const results: GameResult[] = [];

    // We only need to fetch dates up to today to save API calls
    const today = new Date();
    // Convert to YYYYMMDD in ET
    const todayStr = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(today).replace(/(\d+)\/(\d+)\/(\d+)/, "$3$1$2");

    // Fetch matchups for all relevant tournament days
    const promises = [];
    for (const dateStr of Object.values(TOURNAMENT_DAY_DATES)) {
        if (dateStr <= todayStr) {
            promises.push(fetchMatchupsForDate(dateStr));
        }
    }

    const allMatchups = await Promise.all(promises);

    for (const matchups of allMatchups) {
        for (const m of matchups) {
            const isFinal = m.status === 'STATUS_FINAL';

            // Away team
            results.push({
                teamName: m.away,
                status: m.status,
                hasWon: m.awayWinner === true,
                hasLost: isFinal && m.homeWinner === true
            });

            // Home team
            results.push({
                teamName: m.home,
                status: m.status,
                hasWon: m.homeWinner === true,
                hasLost: isFinal && m.awayWinner === true
            });
        }
    }

    return results;
};

// No longer used, but kept for backwards compatibility if needed
export const syncScores = async () => {
    return { success: true, count: 0 };
};
