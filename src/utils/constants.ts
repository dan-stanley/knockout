// 2026 NCAA Tournament Teams (68-team field)
export const TEAMS = [
    // East Region
    "Duke", "Siena", "Ohio State", "TCU", "St. John's", "Northern Iowa",
    "Kansas", "Cal Baptist", "Louisville", "South Florida",
    "Michigan State", "North Dakota State", "UCLA", "UCF", "UConn", "Furman",

    // Midwest Region
    "Michigan", "UMBC", "Howard", "Georgia", "Saint Louis",
    "Texas Tech", "Akron", "Alabama", "Hofstra",
    "Tennessee", "Miami (OH)", "SMU", "Virginia", "Wright State",
    "Kentucky", "Santa Clara", "Iowa State", "Tennessee State",

    // South Region
    "Florida", "Prairie View A&M", "Lehigh", "Clemson", "Iowa",
    "Vanderbilt", "McNeese", "Nebraska", "Troy",
    "North Carolina", "VCU", "Illinois", "Penn",
    "Saint Mary's", "Texas A&M", "Houston", "Idaho",

    // West Region
    "Arizona", "LIU", "Villanova", "Utah State",
    "Wisconsin", "High Point", "Arkansas", "Hawai'i",
    "BYU", "Texas", "NC State", "Gonzaga", "Kennesaw State",
    "Miami (FL)", "Missouri", "Purdue", "Queens"
].sort();

export const TOURNAMENT_DAYS = [
    "Thursday", "Friday", "Saturday", "Sunday",
    "Sweet 16 (Thu)", "Sweet 16 (Fri)", "Elite 8 (Sat)", "Elite 8 (Sun)",
    "Final Four (Sat)", "Championship (Mon)"
];

// First game tip-off time (ET) for each day — picks must be locked before this
export const DAY_LOCK_TIMES: Record<string, string> = {
    "Thursday": "2026-03-19T12:15:00-04:00",
    "Friday": "2026-03-20T12:15:00-04:00",
    "Saturday": "2026-03-21T12:10:00-04:00",
    "Sunday": "2026-03-22T12:10:00-04:00",
    "Sweet 16 (Thu)": "2026-03-26T18:00:00-04:00",
    "Sweet 16 (Fri)": "2026-03-27T18:00:00-04:00",
    "Elite 8 (Sat)": "2026-03-28T14:00:00-04:00",
    "Elite 8 (Sun)": "2026-03-29T14:00:00-04:00",
    "Final Four (Sat)": "2026-04-04T18:00:00-04:00",
    "Championship (Mon)": "2026-04-06T21:00:00-04:00",
};

export const ADMIN_EMAILS = [
    "dcs5092@rit.edu",
    "stanieldaniel@gmail.com",
    "jkohut13@gmail.com",
    "matt@freegoldwatch.com"
];
