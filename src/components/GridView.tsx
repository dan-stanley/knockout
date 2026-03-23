import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { TOURNAMENT_DAYS } from "../utils/constants";
import { syncScores, fetchLiveResults } from "../utils/scoreSync";
import { Link } from "react-router-dom";
import "./GridView.css";

const client = generateClient<Schema>();

const GridView = () => {
    const [entries, setEntries] = useState<any[]>([]);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
                setResults(liveResults || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div>Loading Standings...</div>;

    return (
        <div className="grid-view-container">
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.2rem' }}>Knockout Pool Standings</h2>
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
                        {entries.length === 0 ? (
                            <tr>
                                <td colSpan={TOURNAMENT_DAYS.length + 2}>No entries found.</td>
                            </tr>
                        ) : null}
                        {entries.map((entry: any) => (
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
                                    const picksRecords = entry.picksData ? JSON.parse(entry.picksData) : {};
                                    const picks = picksRecords[day] as string[] | undefined;
                                    return (
                                        <td key={day} className="picks-cell">
                                            {picks && picks.length > 0 ? (
                                                <div className="picks-list">
                                                    {picks.map((p: string) => {
                                                        const res = results.find((r: any) => r.teamName === p);
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
                        ))}
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
