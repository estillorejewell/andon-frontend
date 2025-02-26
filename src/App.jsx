import { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";
import "./App.css"; 

const backendURL = "https://andon-backend.onrender.com"; 
const socket = io(backendURL, { transports: ["websocket"] }); 

const productionAreas = {
  "Loop 1": ["A&T", "TMA", "SUBA/CONA"],
  "Loop 2": ["BSA SOFT", "BSA HARD", "EDM LASER", "FIT/NULL"],
  "Loop 3": ["SBC MACH", "SBC DEBUR"],
  "Loop 4": ["SB", "GMC"],
  "Quality": ["RI", "ZEISS"],
  "Planning": ["STOCKROOM", "SHIPPING"],
};

// ✅ Convert timestamp to Manila Time and calculate elapsed time
const timeAgo = (timestamp) => {
  if (!timestamp) return "";
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const reportTime = new Date(new Date(timestamp).toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const diffInSeconds = Math.floor((now - reportTime) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}hr ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export default function App() {
  const [reports, setReports] = useState([]);
  const [selectedLoop, setSelectedLoop] = useState("Loop 1");
  const [selectedSection, setSelectedSection] = useState(productionAreas["Loop 1"][0]); 
  const [remark, setRemark] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  // ✅ Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);

  // ✅ Live Clock Updates Every Second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    axios.get(`${backendURL}/reports`).then(({ data }) => setReports(data));

    socket.on("newReport", (newReport) => {
      setReports((prev) => {
        const updatedReports = prev.map((r) =>
          r._id === newReport._id ? newReport : r
        );
        return updatedReports.some(r => r._id === newReport._id) ? updatedReports : [...updatedReports, newReport];
      });
    });

    socket.on("resolveReport", ({ id }) => {
      setReports((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: "green", remark: "", timestamp: null } : r))
      );
    });

    return () => {
      socket.off("newReport");
      socket.off("resolveReport");
    };
  }, []);

  const sendReport = (status) => {
    axios.post(`${backendURL}/report`, {
      loop: selectedLoop,
      section: selectedSection,
      status,
      assigned: "John Doe",
      remark: remark,
    }).then(({ data }) => {
      setReports((prev) => [...prev.filter((r) => r._id !== data._id), data]);
      setRemark(""); 
    }).catch(error => console.error("❌ Error sending report:", error));
  };

  // ✅ Open Modal Before Resolving
  const confirmResolve = (id) => {
    setSelectedReportId(id);
    setShowModal(true);
  };

  // ✅ Handle Resolve After Confirmation
  const resolveReport = async () => {
    if (!selectedReportId) return;
    try {
      await axios.post(`${backendURL}/resolve/${selectedReportId}`);
      setShowModal(false);
      setSelectedReportId(null);
    } catch (error) {
      console.error("❌ Error resolving report:", error);
    }
  };

  return (
    <div className="container">
      <div className="clock-container">
        <h2>{currentTime.toLocaleTimeString("en-US", { 
          hour: "2-digit", 
          minute: "2-digit", 
          second: "2-digit", 
          hour12: true, 
          timeZone: "Asia/Manila" 
        })}</h2>
      </div>

      <div className="header-container">
        <img src="/logo.png" alt="Moog Logo" className="moog-logo"/>
        <h1>Andon System</h1>
      </div>

      <div className="reporting-section">
        <h2>Production Reporting</h2>
        <select value={selectedLoop} onChange={(e) => {
          const newLoop = e.target.value;
          setSelectedLoop(newLoop);
          setSelectedSection(productionAreas[newLoop][0]);
        }}>
          {Object.keys(productionAreas).map((loop) => (
            <option key={loop} value={loop}>{loop}</option>
          ))}
        </select>

        <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}>
          {productionAreas[selectedLoop].map((section) => (
            <option key={section} value={section}>{section}</option>
          ))}
        </select>

        <input 
          type="text" 
          placeholder="Enter remark..." 
          value={remark} 
          onChange={(e) => setRemark(e.target.value)} 
          maxLength={20}
          className="remark-input"
        />

        <button className="red-btn" onClick={() => sendReport("red")}>Red</button>
        <button className="yellow-btn" onClick={() => sendReport("yellow")}>Yellow</button>
        <button className="green-btn" onClick={() => sendReport("green")}>Green</button>
      </div>

      <div className="dashboard">
        {Object.entries(productionAreas).map(([loop, sections]) => (
          <div key={loop} className="loop-section">
            <h3>{loop}</h3>
            <div className="grid-container">
              {sections.map((section) => {
                const report = reports.find((r) => r.loop === loop && r.section === section);
                return (
                  <div key={section} className={`grid-item ${report ? report.status : "green"}`}>
                    {section}
                    {report && report.status !== "green" && (
                      <>
                        {report.remark && <p className="remark-text"><strong>!</strong> {report.remark}</p>}
                        {report.timestamp && <p className="timestamp-text"><strong>{timeAgo(report.timestamp)}</strong> </p>}
                        <button className="resolve-btn" onClick={() => confirmResolve(report._id)}>Resolve</button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ✅ Confirmation Modal */}
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Confirm Resolve</h3>
            <p>Are you sure you want to resolve this issue?</p>
            <button onClick={resolveReport} className="confirm-btn">Yes</button>
            <button onClick={() => setShowModal(false)} className="cancel-btn">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
