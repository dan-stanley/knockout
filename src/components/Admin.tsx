import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { TEAMS, TOURNAMENT_DAYS, ADMIN_EMAILS } from "../utils/constants";
import { Link } from "react-router-dom";
import { useAuthenticator } from "@aws-amplify/ui-react";
import "./Admin.css";

const client = generateClient<Schema>();

type EntryType = Schema["Entry"]["type"];

const Admin = () => {
    const { user } = useAuthenticator((context) => [context.user]);
    const userEmail = user?.signInDetails?.loginId;

    const [entries, setEntries] = useState<EntryType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntryId, setSelectedEntryId] = useState<string>("");
    const [selectedDay, setSelectedDay] = useState<string>("Thursday");
    const [adminPicks, setAdminPicks] = useState<string[]>([]);
    const [message, setMessage] = useState("");
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);

    const fetchEntries = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await client.models.Entry.list();
            setEntries(data || []);
            setSelectedEntryId(prev => (!prev && data && data.length > 0) ? data[0].id : prev);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    const selectedEntry = entries.find((e: EntryType) => e.id === selectedEntryId);

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

    const handleCsvImport = async () => {
        if (!csvFile) {
            setMessage("❌ Please select a CSV file first.");
            return;
        }
        setImporting(true);
        setMessage("⏳ Importing from CSV...");

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) {
                setMessage("❌ Could not read file contents.");
                setImporting(false);
                return;
            }

            const rows = text.split(/\r?\n/).filter(r => r.trim());
            let created = 0;
            let errors = 0;

            // Expected CSV Format: OwnerEmail,EntryName,ThursdayPicks(semi-colon sep),FridayPicks...,Saturday...,Sunday...
            for (let i = 0; i < rows.length; i++) {
                // simple split by comma handling (does not handle quoted commas gracefully, so keep team names simple)
                const cols = rows[i].split(',').map(c => c.trim());
                if (cols.length < 2) continue; // skip empty or invalid rows

                // Skip header row if it contains 'email' or 'owner'
                if (i === 0 && cols[0].toLowerCase().includes('email')) continue;

                const [email, entryName, thursStr, friStr, satStr, sunStr] = cols;

                const picksData: Record<string, string[]> = {};
                let used: string[] = [];

                if (thursStr) picksData["Thursday"] = thursStr.split(';').map(t => t.trim()).filter(Boolean);
                if (friStr) picksData["Friday"] = friStr.split(';').map(t => t.trim()).filter(Boolean);
                if (satStr) picksData["Saturday"] = satStr.split(';').map(t => t.trim()).filter(Boolean);
                if (sunStr) picksData["Sunday"] = sunStr.split(';').map(t => t.trim()).filter(Boolean);

                Object.values(picksData).forEach(arr => { used = [...used, ...arr]; });

                try {
                    await client.models.Entry.create({
                        ownerId: email,
                        entryName: entryName,
                        isAlive: true,
                        buybacksUsed: 0,
                        picksData: JSON.stringify(picksData),
                        usedTeams: used
                    });
                    created++;
                } catch (err) {
                    console.error("Failed to parse row:", rows[i], err);
                    errors++;
                }
            }

            setMessage(`✅ Import complete! Created ${created} entries. ${errors > 0 ? `(${errors} failed)` : ''}`);
            setImporting(false);
            setCsvFile(null);
            fetchEntries(); // refresh table
        };
        reader.readAsText(csvFile);
    };

    const handleToggleRebuy = async (entryId: string) => {
        const entry = entries.find((e: EntryType) => e.id === entryId);
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
        const entry = entries.find((e: EntryType) => e.id === entryId);
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

    if (!ADMIN_EMAILS.includes(userEmail || "")) {
        return (
            <div className="admin-container" style={{ textAlign: "center", padding: "4rem 2rem" }}>
                <h2>⛔ Access Denied</h2>
                <p>You do not have permission to view the Knockout Pool admin panel.</p>
                <Link to="/" className="nav-btn" style={{ marginTop: "1rem", display: "inline-block" }}>Return Home</Link>
            </div>
        );
    }

    return (
        <div className="admin-container">
            <h2>🔧 Admin Panel</h2>

            {message && (
                <div className="admin-message">{message}</div>
            )}

            {/* Bulk CSV Import Tool */}
            <div className="admin-section">
                <h3>Bulk Management Tools</h3>

                {/* WIPE BUTTON */}
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#330000', borderRadius: '8px', border: '1px solid #ff0000' }}>
                    <h4 style={{ color: '#ff3333', marginTop: 0 }}>⚠️ DANGER ZONE</h4>
                    <p style={{ fontSize: '0.9rem', color: '#ccc' }}>This will permanently delete all {entries.length} entries currently in the database. Use this to prepare for a clean CSV import.</p>
                    <button
                        style={{ backgroundColor: '#ff0000', color: 'white', fontWeight: 'bold' }}
                        onClick={async () => {
                            if (!window.confirm(`Are you absolutely sure you want to DELETE ALL ${entries.length} entries?`)) return;

                            let deleted = 0;
                            for (const e of entries) {
                                try {
                                    await client.models.Entry.delete({ id: e.id });
                                    deleted++;
                                } catch (err) {
                                    console.error("Failed to delete", e.id, err);
                                }
                            }
                            alert(`Deleted ${deleted} entries!`);
                            fetchEntries();
                        }}
                    >
                        Wipe Database Clean
                    </button>
                </div>

                <div className="admin-import-controls">
                    <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '10px' }}>
                        Upload a CSV file. Format: <code>OwnerEmail,EntryName,ThursdayPicks,FridayPicks,SaturdayPicks,SundayPicks</code>
                        <br />
                        <em>(Separate multiple picks on the same day using semicolons `;`)</em>
                    </p>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    />
                    <button
                        className="admin-submit"
                        onClick={handleCsvImport}
                        disabled={!csvFile || importing}
                        style={{ marginLeft: '10px' }}
                    >
                        {importing ? "Importing..." : "Run Import"}
                    </button>
                </div>
            </div>

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
                        {entries.map((entry: EntryType) => (
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
                            {entries.map((e: EntryType) => <option key={e.id} value={e.id}>{e.entryName}</option>)}
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
