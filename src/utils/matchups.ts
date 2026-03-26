// Dynamic matchup fetching from ESPN NCAA Tournament Scoreboard API
// No hardcoded data — works for any year, any tournament

export interface Matchup {
    away: string;
    awayLogo: string;
    home: string;
    homeLogo: string;
    awayWinner?: boolean;
    homeWinner?: boolean;
    time: string;
    date: string;      // ISO date string
    status: string;     // STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL
    gameId: string;
}

// Cache fetched matchups by date string (YYYYMMDD)
const matchupCache: Record<string, Matchup[]> = {};

// Map an ESPN display name ("Kentucky Wildcats") to a short name ("Kentucky")
const shortenTeamName = (displayName: string): string => {
    // Common suffixes to strip
    const suffixes = [
        'Wildcats', 'Bulldogs', 'Tigers', 'Bears', 'Eagles', 'Hawks',
        'Cardinals', 'Panthers', 'Cougars', 'Mustangs', 'Huskies',
        'Wolverines', 'Spartans', 'Bruins', 'Knights', 'Volunteers',
        'Crimson Tide', 'Razorbacks', 'Boilermakers', 'Hoosiers',
        'Fighting Illini', 'Hawkeyes', 'Cyclones', 'Red Raiders',
        'Cavaliers', 'Tar Heels', 'Blue Devils', 'Orange',
        'Seminoles', 'Hurricanes', 'Yellow Jackets', 'Demon Deacons',
        'Wolfpack', 'Aggies', 'Longhorns', 'Horned Frogs', 'Jayhawks',
        'Cornhuskers', 'Badgers', 'Gophers', 'Buckeyes', 'Nittany Lions',
        'Terrapins', 'Scarlet Knights', 'Mountaineers', 'Sooners',
        'Cowboys', 'Beavers', 'Ducks', 'Trojans', 'Buffaloes',
        'Sun Devils', 'Utes', 'Golden Bears', 'Cardinal',
        'Zips', 'Broncos', 'Gaels', 'Rams', 'Paladins', 'Sharks',
        'Saints', 'Billikens', 'Musketeers', 'Friars', 'Hoyas',
        'Pirates', 'Dukes', 'Peacocks', 'Leopards', 'Mountain Hawks',
        'Quakers', 'Big Green', 'Colonels', 'Red Storm',
        'Raiders', 'Golden Eagles', 'Buccaneers',
        'Lumberjacks', 'Owls', 'Red Wolves', 'Rattlers',
        'Pride', 'Monarchs', 'Royals', 'Golden Knights',
        'Gators', 'Bulls', 'Blazers', 'Trojans', 'Islanders',
        'Rainbow Warriors', 'Toreros', 'Waves', 'Lions',
        'Red Foxes', 'Bonnies', 'Flyers', 'Explorers',
        'Mocs', 'Catamounts', 'Terriers', 'Spiders',
        'Retrievers', 'Bison', 'Penguins', 'Chippewas',
        'Golden Flashes', 'Bobcats', 'Rockets', 'Falcons', 'Commodores'
    ];

    for (const suffix of suffixes) {
        if (displayName.endsWith(` ${suffix}`)) {
            displayName = displayName.replace(` ${suffix}`, '');
            break;
        }
    }

    // Explicit overrides for exact matches to sync with our constants.ts
    if (displayName === 'Miami') return 'Miami (FL)';

    return displayName;
};

// Fetch matchups for a specific date from ESPN
export const fetchMatchupsForDate = async (dateStr: string): Promise<Matchup[]> => {
    if (matchupCache[dateStr]) return matchupCache[dateStr];

    try {
        const res = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${dateStr}&limit=100&groups=100`
        );
        const data = await res.json();

        const matchups: Matchup[] = [];
        for (const event of data.events || []) {
            const comp = event.competitions?.[0];
            if (!comp) continue;

            const homeTeam = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'home');
            const awayTeam = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'away');
            if (!homeTeam || !awayTeam) continue;

            const gameDate = new Date(comp.date);
            const timeStr = gameDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: 'America/New_York',
            });

            matchups.push({
                away: shortenTeamName(awayTeam.team?.displayName || ''),
                awayLogo: awayTeam.team?.logo || '',
                awayWinner: awayTeam.winner,
                home: shortenTeamName(homeTeam.team?.displayName || ''),
                homeLogo: homeTeam.team?.logo || '',
                homeWinner: homeTeam.winner,
                time: timeStr,
                date: comp.date,
                status: comp.status?.type?.name || '',
                gameId: event.id || '',
            });
        }

        // Sort by tip-off time
        matchups.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        matchupCache[dateStr] = matchups;
        return matchups;
    } catch (e) {
        console.error(`Failed to fetch matchups for ${dateStr}:`, e);
        return [];
    }
};

// Map tournament day names to actual dates for 2026
// This could also be dynamic but the tournament dates are known ahead of time
export const TOURNAMENT_DAY_DATES: Record<string, string> = {
    "Thursday": "20260319",
    "Friday": "20260320",
    "Saturday": "20260321",
    "Sunday": "20260322",
    "Sweet 16 (Thu)": "20260326",
    "Sweet 16 (Fri)": "20260327",
    "Elite 8 (Sat)": "20260328",
    "Elite 8 (Sun)": "20260329",
    "Final Four (Sat)": "20260404",
    "Championship (Mon)": "20260406",
};

// Main function: get matchups for a tournament day name
export const getMatchupsForDay = async (dayName: string): Promise<Matchup[]> => {
    const dateStr = TOURNAMENT_DAY_DATES[dayName];
    if (!dateStr) return [];
    return fetchMatchupsForDate(dateStr);
};
