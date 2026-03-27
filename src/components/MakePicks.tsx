import { useState, useEffect, useCallback, useMemo } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { TEAMS, TOURNAMENT_DAYS, DAY_LOCK_TIMES } from "../utils/constants";
import { TEAM_LOGOS } from "../utils/teamLogos";
import { getMatchupsForDay } from "../utils/matchups";
import type { Matchup } from "../utils/matchups";
import { syncScores, fetchLiveResults } from "../utils/scoreSync";
import type { AuthUser } from "aws-amplify/auth";
import type { GameResult } from "../utils/scoreSync";
import { Link } from "react-router-dom";
import "./MakePicks.css";

const client = generateClient<Schema>();
type EntryType = Schema["Entry"]["type"];

const MakePicks = ({ user }: { user?: AuthUser }) => {
    const [entries, setEntries] = useState<EntryType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntryId, setSelectedEntryId] = useState<string>("");
    const [newEntryName, setNewEntryName] = useState("");

    const [selectedDay, setSelectedDay] = useState<string>("");
    const [picks, setPicks] = useState<string[]>([]);
    const [gameResults, setGameResults] = useState<Record<string, GameResult[]>>({});
    const [dayMatchups, setDayMatchups] = useState<Matchup[]>([]);
    const [matchupsLoading, setMatchupsLoading] = useState(false);

    const userId = user?.signInDetails?.loginId || user?.username || "";

    const fetchEntries = useCallback(async () => {
        try {
            setLoading(true);
            await syncScores();

            const [entriesData, liveResults] = await Promise.all([
                client.models.Entry.list({ filter: { ownerId: { eq: userId } } }),
                fetchLiveResults()
            ]);
            setEntries(entriesData.data || []);
            setGameResults(liveResults || {});
            if (entriesData.data && entriesData.data.length > 0 && !selectedEntryId) {
                setSelectedEntryId(entriesData.data[0].id);
            }
        } catch (e) {
            console.error("Error fetching entries:", e);
        } finally {
            setLoading(false);
        }
    }, [userId, selectedEntryId]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const handleCreateEntry = async () => {
        if (!newEntryName.trim()) return;
        if (entries.length >= 3) {
            alert("Maximum of 3 entries allowed!");
            return;
        }
        try {
            const { data: newEntry } = await client.models.Entry.create({
                ownerId: userId,
                entryName: newEntryName,
                isAlive: true,
                buybacksUsed: 0,
                usedTeams: [],
                picksData: "{}"
            });
            setNewEntryName("");
            await fetchEntries();
            if (newEntry) setSelectedEntryId(newEntry.id);
        } catch (e) {
            console.error("Error creating entry:", e);
            alert("Error creating entry - check console");
        }
    };

    const selectedEntry = entries.find((e: EntryType) => e.id === selectedEntryId);

    const otherDaysTeams = useMemo(() => {
        let teams: string[] = [];
        if (selectedEntry?.picksData) {
            const picksRecords = JSON.parse(selectedEntry.picksData);
            for (const day of Object.keys(picksRecords)) {
                if (day !== selectedDay) {
                    teams = [...teams, ...picksRecords[day]];
                }
            }
        }
        return teams;
    }, [selectedEntry, selectedDay]);

    // --- Day status logic ---

    // Is the pick window for this day closed? (games have started or are over)
    const isDayLocked = useCallback((day: string): boolean => {
        const lockTime = DAY_LOCK_TIMES[day];
        if (!lockTime) return false;
        return new Date() >= new Date(lockTime);
    }, []);

    // Has this entry already submitted picks for this day?
    const hasPicksForDay = useCallback((day: string): boolean => {
        const picksRecords = selectedEntry?.picksData ? JSON.parse(selectedEntry.picksData) : {};
        const dayPicks = picksRecords[day] as string[] | undefined;
        return !!(dayPicks && dayPicks.length > 0);
    }, [selectedEntry]);

    // Is a day eligible for picking? Must meet ALL conditions:
    // 1. Games haven't started yet (not locked by time)
    // 2. Picks haven't already been submitted for this day
    // 3. Previous day is either:
    //    a. Time-locked (games already happened — treats rebuys/admin entries as settled)
    //    b. Has picks that are all settled (won or lost)
    //    OR it's the first day (Thursday)
    const isDayPickable = useCallback((day: string): boolean => {
        // Already locked by tipoff time
        if (isDayLocked(day)) return false;

        const dayIndex = TOURNAMENT_DAYS.indexOf(day);

        // Thursday is always pickable if not locked and no picks submitted
        if (dayIndex === 0) return true;

        // Check previous day
        const prevDay = TOURNAMENT_DAYS[dayIndex - 1];

        // If previous day's games have already started/finished, this day is open
        // (handles buyback entries, admin-entered picks, etc.)
        if (isDayLocked(prevDay)) return true;

        // Otherwise, previous day must have picks and they must all be settled
        const picksRecords = selectedEntry?.picksData ? JSON.parse(selectedEntry.picksData) : {};
        const prevPicks = picksRecords[prevDay] as string[] | undefined;

        if (!prevPicks || prevPicks.length === 0) return false;

        return prevPicks.every((team: string) => {
            const dayResults = gameResults[prevDay] || [];
            const result = dayResults.find((r) => r.teamName === team);
            return result && (result.hasWon || result.hasLost);
        });
    }, [gameResults, selectedEntry, isDayLocked]);

    // Get the day status label for display
    const getDayStatus = useCallback((day: string): "pickable" | "editable" | "locked" | "locked_submitted" | "upcoming" => {
        const hasPicks = hasPicksForDay(day);
        const locked = isDayLocked(day);

        if (locked && hasPicks) return "locked_submitted";
        if (locked && !hasPicks) return "locked";

        if (hasPicks) return "editable";
        if (isDayPickable(day)) return "pickable";

        return "upcoming";
    }, [isDayPickable, hasPicksForDay, isDayLocked]);

    // Auto-select the first pickable day
    useEffect(() => {
        if (!selectedEntry || loading) return;
        const pd = selectedEntry.picksData ? JSON.parse(selectedEntry.picksData) : {};

        // Find first day that doesn't have picks and is pickable
        const firstEmptyPickable = TOURNAMENT_DAYS.find(day => isDayPickable(day) && !hasPicksForDay(day));

        if (firstEmptyPickable && selectedDay !== firstEmptyPickable) {
            setSelectedDay(firstEmptyPickable);
            setPicks(pd[firstEmptyPickable] || []);
        } else if (!firstEmptyPickable && !selectedDay) {
            // No empty pickable day — show the latest submitted or locked day
            const latestSubmitted = [...TOURNAMENT_DAYS].reverse().find(day => hasPicksForDay(day));
            const dayToSelect = latestSubmitted || TOURNAMENT_DAYS[0];
            setSelectedDay(dayToSelect);
            setPicks(pd[dayToSelect] || []);
        } else if (selectedDay && picks.length === 0 && pd[selectedDay]) {
            // Give picks their initial value if already selected but empty
            setPicks(pd[selectedDay]);
        }
    }, [selectedEntry, loading, isDayPickable, hasPicksForDay, selectedDay, picks.length, gameResults]);

    // Auto-detect if entry needs buyback by checking if any previous picks lost
    const needsBuyback = useCallback((): boolean => {
        const picksRecords = selectedEntry?.picksData ? JSON.parse(selectedEntry.picksData) : {};
        // Check all previous days' picks for losses
        for (const day of TOURNAMENT_DAYS) {
            const dayPicks = picksRecords[day] as string[] | undefined;
            if (!dayPicks) continue;
            for (const team of dayPicks) {
                const dayResults = gameResults[day] || [];
                const result = dayResults.find((r) => r.teamName === team);
                if (result?.hasLost) return true;
            }
        }
        return false;
    }, [gameResults, selectedEntry]);

    const getRequiredPicksCount = useCallback((day: string) => {
        const buyback = needsBuyback();
        if (day === "Thursday") return 2;
        if (day === "Friday") return buyback ? 4 : 2;
        if (day === "Saturday") return buyback ? 5 : 1;
        if (day === "Sunday") return buyback ? 6 : 1;
        return 1;
    }, [needsBuyback]);

    // Fetch matchups dynamically when selected day changes
    useEffect(() => {
        if (!selectedDay) return;
        let cancelled = false;
        setMatchupsLoading(true);
        getMatchupsForDay(selectedDay).then(matchups => {
            if (!cancelled) {
                setDayMatchups(matchups);
                setMatchupsLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [selectedDay]);

    // Get filtered matchups (exclude teams used on OTHER days)
    const getFilteredMatchups = useCallback(() => {
        if (dayMatchups.length > 0) return dayMatchups;

        // Fallback for days with no API data: show winners list
        const winners = TEAMS.filter(team => {
            let result;
            for (const d of TOURNAMENT_DAYS) {
                const res = (gameResults[d] || []).find((r) => r.teamName === team);
                if (res) { result = res; break; }
            }
            return result?.hasWon === true;
        });
        return winners;
    }, [dayMatchups, gameResults]);

    const filteredMatchups = getFilteredMatchups();
    const hasSchedule = Array.isArray(filteredMatchups) && filteredMatchups.length > 0 && typeof filteredMatchups[0] === 'object' && 'away' in filteredMatchups[0];
    const currentDayStatus = getDayStatus(selectedDay);

    const handleTogglePick = (team: string) => {
        if (currentDayStatus !== "pickable" && currentDayStatus !== "editable") return;
        const required = getRequiredPicksCount(selectedDay);

        if (picks.includes(team)) {
            // Deselect
            setPicks(picks.filter(p => p !== team));
        } else {
            // Find opponent in the same matchup (using dynamic matchups)
            let opponent: string | null = null;
            if (dayMatchups.length > 0) {
                const matchup = dayMatchups.find(m => m.away === team || m.home === team);
                if (matchup) {
                    opponent = matchup.away === team ? matchup.home : matchup.away;
                }
            }

            // Remove opponent if they're already picked (swap)
            const updatedPicks = opponent ? picks.filter(p => p !== opponent) : [...picks];

            if (updatedPicks.length < required) {
                setPicks([...updatedPicks, team]);
            } else {
                // If maximum picks reached, smoothly drop the oldest pick to accept the new selection
                const shiftedPicks = updatedPicks.slice(1);
                setPicks([...shiftedPicks, team]);
            }
        }
    };

    const handleSubmitPicks = async () => {
        if (!selectedEntry || (currentDayStatus !== "pickable" && currentDayStatus !== "editable")) return;
        const required = getRequiredPicksCount(selectedDay);
        if (picks.length !== required) {
            alert(`Please select exactly ${required} teams!`);
            return;
        }

        const updateData: { id: string; picksData?: string; usedTeams?: string[] } = { id: selectedEntry.id };
        const currentData = selectedEntry.picksData ? JSON.parse(selectedEntry.picksData) : {};
        currentData[selectedDay] = picks;

        updateData.picksData = JSON.stringify(currentData);

        // Compute all used teams from scratch to avoid accumulating old edits
        const allUsedTeams: string[] = [];
        for (const pt of Object.values(currentData)) {
            allUsedTeams.push(...(pt as string[]));
        }
        updateData.usedTeams = allUsedTeams;

        try {
            await client.models.Entry.update(updateData);
            setPicks([]);
            await fetchEntries();
            alert("Picks submitted!");
        } catch (e) {
            console.error("Error submitting picks:", e);
            alert("Error submitting picks - check console");
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="make-picks-container">
            <h2>Make Your Picks</h2>

            {entries.length < 3 && new Date() < new Date(DAY_LOCK_TIMES["Thursday"] || 0) && (
                <div className="create-entry">
                    <input
                        value={newEntryName}
                        onChange={e => setNewEntryName(e.target.value)}
                        placeholder="New Entry Name (e.g. Dan - Entry 1)"
                    />
                    <button onClick={handleCreateEntry}>Create Entry</button>
                </div>
            )}

            {entries.length > 0 ? (
                <div className="picks-interface">
                    <div className="entry-selector">
                        <label>Select Entry: </label>
                        <select value={selectedEntryId} onChange={e => {
                            const id = e.target.value;
                            setSelectedEntryId(id);
                            const entry = entries.find((en: EntryType) => en.id === id);
                            const pd = entry?.picksData ? JSON.parse(entry.picksData) : {};
                            setPicks(pd[selectedDay] || []);
                        }}>
                            {entries.map((e: EntryType) => <option key={e.id} value={e.id}>{e.entryName} {e.isAlive ? '' : '(Eliminated)'}</option>)}
                        </select>
                        <div className="entry-stats">
                            Buybacks Used: {selectedEntry?.buybacksUsed || 0} / 3
                        </div>
                    </div>

                    <div className="day-selector">
                        {TOURNAMENT_DAYS.map(day => {
                            const status = getDayStatus(day);
                            const isActive = selectedDay === day;
                            const isLocked = status === "locked" || status === "locked_submitted";
                            const isSubmitted = status === "editable" || status === "locked_submitted";

                            return (
                                <button
                                    key={day}
                                    className={`${isActive ? "active" : ""} ${isLocked || status === "upcoming" ? "day-locked" : ""} ${isSubmitted ? "day-submitted" : ""}`}
                                    onClick={() => {
                                        if (status !== "upcoming") {
                                            setSelectedDay(day);
                                            const pd = selectedEntry?.picksData ? JSON.parse(selectedEntry.picksData) : {};
                                            setPicks(pd[day] || []);
                                        }
                                    }}
                                    disabled={status === "upcoming"}
                                    title={
                                        isLocked ? "Games have already started" :
                                            isSubmitted ? "Picks already submitted" :
                                                status === "upcoming" ? "Previous day must be settled first" : ""
                                    }
                                >
                                    {isLocked && "🔒 "}
                                    {isSubmitted && !isLocked && "✅ "}
                                    {status === "upcoming" && "🔒 "}
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Status message */}
                    {(currentDayStatus === "locked" || currentDayStatus === "locked_submitted") && (
                        <div className="pick-status-message locked-message">
                            🔒 {selectedDay} games have already started. Picks are locked.
                        </div>
                    )}
                    {currentDayStatus === "editable" && (
                        <div className="pick-status-message submitted-message">
                            ✅ Picks submitted! You can still edit them until the games tip off.
                        </div>
                    )}

                    {(currentDayStatus === "pickable" || currentDayStatus === "editable") && (
                        <>
                            <div className="pick-instructions">
                                <p>Select {getRequiredPicksCount(selectedDay)} team(s) for {selectedDay}.</p>
                            </div>

                            {hasSchedule ? (
                                <div className="matchup-grid">
                                    {matchupsLoading ? <p>Loading games...</p> : (filteredMatchups as Matchup[]).map((m) => (
                                        <div key={m.gameId || `${m.away}-${m.home}`} className="matchup-card">
                                            <div className="matchup-time">{m.time || ''}</div>
                                            <div
                                                className={`matchup-team away ${picks.includes(m.away) ? 'picked' : ''} ${otherDaysTeams.includes(m.away) ? 'disabled-team' : ''}`}
                                                onClick={() => !otherDaysTeams.includes(m.away) && handleTogglePick(m.away)}
                                            >
                                                {TEAM_LOGOS[m.away] && <img src={TEAM_LOGOS[m.away]} alt={m.away} className="matchup-logo" />}
                                                <span>{m.away}</span>
                                            </div>
                                            <div className="matchup-at">@</div>
                                            <div
                                                className={`matchup-team home ${picks.includes(m.home) ? 'picked' : ''} ${otherDaysTeams.includes(m.home) ? 'disabled-team' : ''}`}
                                                onClick={() => !otherDaysTeams.includes(m.home) && handleTogglePick(m.home)}
                                            >
                                                {TEAM_LOGOS[m.home] && <img src={TEAM_LOGOS[m.home]} alt={m.home} className="matchup-logo" />}
                                                <span>{m.home}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="team-grid">
                                    {(filteredMatchups as string[]).map((team: string) => (
                                        <div
                                            key={team}
                                            className={`team-card ${picks.includes(team) ? "selected" : ""} ${otherDaysTeams.includes(team) ? 'disabled-team' : ''}`}
                                            onClick={() => !otherDaysTeams.includes(team) && handleTogglePick(team)}
                                        >
                                            {TEAM_LOGOS[team] && <img src={TEAM_LOGOS[team]} alt={team} className="team-logo" />}
                                            <span className="team-name">{team}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button className="submit-button" onClick={handleSubmitPicks} disabled={picks.length === 0}>
                                {currentDayStatus === "editable" ? "Update Picks" : "Submit Picks"}
                            </button>
                        </>
                    )}

                    {/* Show submitted picks for this day (read-only view) */}
                    {currentDayStatus === "locked_submitted" && (
                        <div className="submitted-picks-view">
                            <h3>Submitted Picks for {selectedDay}:</h3>
                            <div className="team-grid">
                                {(() => {
                                    const pd = selectedEntry?.picksData ? JSON.parse(selectedEntry.picksData) : {};
                                    const dayPicks = (pd[selectedDay] || []) as string[];
                                    return dayPicks.map((team: string) => {
                                        const dayResults = gameResults[selectedDay] || [];
                                        const result = dayResults.find((r) => r.teamName === team);
                                        let statusClass = "";
                                        if (result?.hasWon) statusClass = "pick-won-card";
                                        if (result?.hasLost) statusClass = "pick-lost-card";
                                        return (
                                            <div key={team} className={`team-card ${statusClass}`} style={{ cursor: 'default' }}>
                                                {TEAM_LOGOS[team] && (
                                                    <img src={TEAM_LOGOS[team]} alt={team} className="team-logo" />
                                                )}
                                                <span className="team-name">{team}</span>
                                                {result?.hasWon && <span className="pick-result">✅ WON</span>}
                                                {result?.hasLost && <span className="pick-result">❌ LOST</span>}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <p>Please create an entry to start playing.</p>
            )}

            <div className="nav-buttons">
                <Link to="/" className="nav-btn">Home</Link>
                <Link to="/standings" className="nav-btn">Standings</Link>
            </div>
        </div>
    );
};

export default MakePicks;
