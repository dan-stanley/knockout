import { fetchMatchupsForDate, TOURNAMENT_DAY_DATES } from './matchups';

export interface GameResult {
    teamName: string;
    hasWon: boolean;
    hasLost: boolean;
    status: string;
}

// Fetch all game results for the tournament directly from ESPN API
// This completely bypasses the AWS database, keeping the app fast and always up-to-date
export const fetchLiveResults = async (): Promise<Record<string, GameResult[]>> => {
    const resultsByDay: Record<string, GameResult[]> = {};

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
    const validDays: string[] = [];

    for (const [dayName, dateStr] of Object.entries(TOURNAMENT_DAY_DATES)) {
        if (dateStr <= todayStr) {
            promises.push(fetchMatchupsForDate(dateStr));
            validDays.push(dayName);
        }
    }

    const allMatchups = await Promise.all(promises);

    for (let i = 0; i < allMatchups.length; i++) {
        const matchups = allMatchups[i];
        const dayName = validDays[i];
        const dayResults: GameResult[] = [];

        for (const m of matchups) {
            const isFinal = m.status === 'STATUS_FINAL';

            // Away team
            dayResults.push({
                teamName: m.away,
                status: m.status,
                hasWon: m.awayWinner === true,
                hasLost: isFinal && m.homeWinner === true
            });

            // Home team
            dayResults.push({
                teamName: m.home,
                status: m.status,
                hasWon: m.homeWinner === true,
                hasLost: isFinal && m.awayWinner === true
            });
        }
        resultsByDay[dayName] = dayResults;
    }

    return resultsByDay;
};

// No longer used, but kept for backwards compatibility if needed
export const syncScores = async () => {
    return { success: true, count: 0 };
};
