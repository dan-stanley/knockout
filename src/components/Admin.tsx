import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { TEAMS, TOURNAMENT_DAYS } from "../utils/constants";
import { Link } from "react-router-dom";
import "./Admin.css";

const client = generateClient<Schema>();

const Admin = () => {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntryId, setSelectedEntryId] = useState<string>("");
    const [selectedDay, setSelectedDay] = useState<string>("Thursday");
    const [adminPicks, setAdminPicks] = useState<string[]>([]);
    const [message, setMessage] = useState("");

    const fetchEntries = async () => {
        try {
            setLoading(true);
            const { data } = await client.models.Entry.list();
            setEntries(data || []);
            if (data && data.length > 0 && !selectedEntryId) {
                setSelectedEntryId(data[0].id);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEntries(); }, []);

    const selectedEntry = entries.find((e: any) => e.id === selectedEntryId);

    const handleTogglePick = (team: string) => {
        if (adminPicks.includes(team)) {
            setAdminPicks(adminPicks.filter(p => p !== team));
        } else {
            setAdminPicks([...adminPicks, team]);
        }
    };

    const handleSubmitPicks = async () => {
        if (!selectedEntry || adminPicks.length === 0) return;

        const currentData = selectedEntry.picksData ? JSON.parse(selectedEntry.picksData) : {};
        currentData[selectedDay] = adminPicks;

        try {
            await client.models.Entry.update({
                id: selectedEntry.id,
                picksData: JSON.stringify(currentData),
                usedTeams: [...new Set([...(selectedEntry.usedTeams || []), ...adminPicks])]
            });
            setAdminPicks([]);
            setMessage(`✅ Picks saved for ${selectedEntry.entryName} on ${selectedDay}`);
            await fetchEntries();
        } catch (e) {
            console.error(e);
            setMessage("❌ Error saving picks");
        }
    };

    const handleToggleRebuy = async (entryId: string) => {
        const entry = entries.find((e: any) => e.id === entryId);
        if (!entry) return;

        const newBuybacks = (entry.buybacksUsed || 0) + 1;
        if (newBuybacks > 3) {
            setMessage("❌ Maximum 3 buybacks reached for this entry");
            return;
        }

        try {
            await client.models.Entry.update({
                id: entryId,
                buybacksUsed: newBuybacks,
                isAlive: true, // Rebuy brings them back alive
            });
            setMessage(`✅ ${entry.entryName} rebuyed (${newBuybacks}/3)`);
            await fetchEntries();
        } catch (e) {
            console.error(e);
            setMessage("❌ Error processing rebuy");
        }
    };

    const handleToggleEliminate = async (entryId: string) => {
        const entry = entries.find((e: any) => e.id === entryId);
        if (!entry) return;

        try {
            await client.models.Entry.update({
                id: entryId,
                isAlive: !entry.isAlive,
            });
            setMessage(`✅ ${entry.entryName} ${entry.isAlive ? 'eliminated' : 'restored'}`);
            await fetchEntries();
        } catch (e) {
            console.error(e);
            setMessage("❌ Error updating entry status");
        }
    };

    const availableTeams = TEAMS.filter(t => !selectedEntry?.usedTeams?.includes(t));

    if (loading) return <div>Loading Admin...</div>;

    return (
        <div className="admin-container">
            <h2>🔧 Admin Panel</h2>

            {message && (
                <div className="admin-message">{message}</div>
            )}

            {/* Entry Management Section */}
            <div className="admin-section">
                <h3>Entry Management</h3>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Entry Name</th>
                            <th>Owner</th>
                            <th>Status</th>
                            <th>Buybacks</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry: any) => (
                            <tr key={entry.id} className={!entry.isAlive ? "admin-eliminated" : ""}>
                                <td>{entry.entryName}</td>
                                <td style={{ fontSize: '0.8rem', color: '#999' }}>{entry.ownerId}</td>
                                <td>
                                    <span className={entry.isAlive ? "status-alive" : "status-eliminated"}>
                                        {entry.isAlive ? "ALIVE" : "ELIMINATED"}
                                    </span>
                                </td>
                                <td>{entry.buybacksUsed || 0}/3</td>
                                <td className="admin-actions">
                                    <button
                                        className="btn-rebuy"
                                        onClick={() => handleToggleRebuy(entry.id)}
                                        disabled={(entry.buybacksUsed || 0) >= 3}
                                    >
                                        💰 Rebuy
                                    </button>
                                    <button
                                        className={`btn-eliminate ${entry.isAlive ? '' : 'btn-restore'}`}
                                        onClick={() => handleToggleEliminate(entry.id)}
                                    >
                                        {entry.isAlive ? "❌ Eliminate" : "✅ Restore"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Manual Picks Section */}
            <div className="admin-section">
                <h3>Add Picks Manually</h3>
                <div className="admin-pick-controls">
                    <div>
                        <label>Entry: </label>
                        <select value={selectedEntryId} onChange={e => setSelectedEntryId(e.target.value)}>
                            {entries.map((e: any) => <option key={e.id} value={e.id}>{e.entryName}</option>)}
                        </select>
                    </div>
                    <div>
                        <label>Day: </label>
                        <select value={selectedDay} onChange={e => { setSelectedDay(e.target.value); setAdminPicks([]); }}>
                            {TOURNAMENT_DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                        </select>
                    </div>
                </div>

                {selectedEntry && (
                    <div className="admin-current-picks">
                        <strong>Current picks for {selectedDay}: </strong>
                        {(() => {
                            const pd = selectedEntry.picksData ? JSON.parse(selectedEntry.picksData) : {};
                            const dayPicks = pd[selectedDay] as string[] | undefined;
                            return dayPicks && dayPicks.length > 0
                                ? dayPicks.join(", ")
                                : "None";
                        })()}
                    </div>
                )}

                <div className="admin-team-grid">
                    {availableTeams.map(team => (
                        <div
                            key={team}
                            className={`admin-team-card ${adminPicks.includes(team) ? "selected" : ""}`}
                            onClick={() => handleTogglePick(team)}
                        >
                            {team}
                        </div>
                    ))}
                </div>

                <button className="admin-submit" onClick={handleSubmitPicks} disabled={adminPicks.length === 0}>
                    Save Picks ({adminPicks.length} selected)
                </button>
            </div>

            <div className="nav-buttons">
                <Link to="/" className="nav-btn">Home</Link>
                <Link to="/picks" className="nav-btn">Make Picks</Link>
                <Link to="/standings" className="nav-btn">Standings</Link>
            </div>
        </div>
    );
};

export default Admin;
