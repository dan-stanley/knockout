import { useState, useEffect, useMemo } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { TOURNAMENT_DAYS, DAY_LOCK_TIMES } from "../utils/constants";
import { syncScores, fetchLiveResults } from "../utils/scoreSync";
import type { GameResult } from "../utils/scoreSync";
import type { AuthUser } from "aws-amplify/auth";
import { Link } from "react-router-dom";
import "./GridView.css";

const client = generateClient<Schema>();
type EntryType = Schema["Entry"]["type"];

const GridView = ({ user }: { user?: AuthUser }) => {
    const [entries, setEntries] = useState<EntryType[]>([]);
    const [results, setResults] = useState<Record<string, GameResult[]>>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const userId = user?.signInDetails?.loginId || user?.username || "";

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Auto-sync scores on page load
                await syncScores();

                const [{ data: entryData }, liveResults] = await Promise.all([
                    client.models.Entry.list(),
                    fetchLiveResults()
                ]);
                setEntries(entryData);
                setResults(liveResults || {});
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredEntries = useMemo(() => {
        if (!searchQuery) return entries;
        return entries.filter(e => e.entryName?.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [entries, searchQuery]);

    if (loading) return <div>Loading Standings...</div>;

    return (
        <div className="grid-view-container">
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.2rem' }}>Knockout Pool Standings</h2>

            <div className="search-container" style={{ marginBottom: '1rem' }}>
                <input
                    type="text"
                    placeholder="Search entries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    list="entries-list"
                    className="search-input"
                    style={{ padding: '8px', width: '250px', borderRadius: '4px', border: '1px solid #ccc', color: '#333' }}
                />
                <datalist id="entries-list">
                    {entries.map(e => (
                        <option key={e.id} value={e.entryName || ""} />
                    ))}
                </datalist>
            </div>

            <div className="table-responsive">
                <table className="standings-table">
                    <thead>
                        <tr>
                            <th>Entry</th>
                            <th>Status</th>
                            {TOURNAMENT_DAYS.map(day => (
                                <th key={day}>{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEntries.length === 0 ? (
                            <tr>
                                <td colSpan={TOURNAMENT_DAYS.length + 2}>No entries found.</td>
                            </tr>
                        ) : null}
                        {filteredEntries.map((entry: EntryType) => {
                            const isMyEntry = entry.ownerId === userId;
                            return (
                                <tr key={entry.id} className={!entry.isAlive ? "eliminated-row" : ""}>
                                    <td className="entry-name-cell">
                                        {entry.entryName}
                                    </td>
                                    <td>
                                        {entry.isAlive ? (
                                            <span className="status-alive">✓</span>
                                        ) : (
                                            <span className="status-eliminated">✗</span>
                                        )}
                                    </td>
                                    {TOURNAMENT_DAYS.map(day => {
                                        const isDayLocked = new Date() >= new Date(DAY_LOCK_TIMES[day] || 0);
                                        if (!isMyEntry && !isDayLocked) {
                                            return (
                                                <td key={day} className="picks-cell">
                                                    <span style={{ color: '#888', fontStyle: 'italic', fontSize: '0.8rem' }}>🔒 Hidden</span>
                                                </td>
                                            );
                                        }

                                        const picksRecords = entry.picksData ? JSON.parse(entry.picksData) : {};
                                        const picks = picksRecords[day] as string[] | undefined;
                                        return (
                                            <td key={day} className="picks-cell">
                                                {picks && picks.length > 0 ? (
                                                    <div className="picks-list">
                                                        {picks.map((p: string) => {
                                                            const dayResults = results[day] || [];
                                                            const res = dayResults.find((r) => r.teamName === p);
                                                            let statusClass = "";
                                                            if (res?.hasWon) statusClass = "pick-won";
                                                            if (res?.hasLost) statusClass = "pick-lost";
                                                            return <div key={p} className={`pick-item ${statusClass}`}>{p}</div>;
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="no-pick">-</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="nav-buttons">
                <Link to="/" className="nav-btn">Home</Link>
                <Link to="/picks" className="nav-btn">Make Picks</Link>
            </div>
        </div>
    );
};

export default GridView;
