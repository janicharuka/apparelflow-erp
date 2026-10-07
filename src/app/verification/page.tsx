 "use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { demoOrders } from "@/data/demo";
import { canApprove, getComponentStatus, type VerificationItem } from "@/lib/domain";

export default function VerificationPage() {
  const order = demoOrders[0];
  const [items,setItems] = useState<VerificationItem[]>(() => order.recipe.components.map(c=>({componentId:c.id,componentName:c.name,expectedQty:order.targetQty*c.piecesPerGarment,actualQty:order.targetQty*c.piecesPerGarment,status:"GREEN"})));
  const [message,setMessage] = useState("");
  const approve = canApprove(items);

  function update(id:string,value:string) {
    const actual = Number(value);
    if (!Number.isInteger(actual) || actual < 0) return;
    setItems(items.map(i=>i.componentId===id ? {...i,actualQty:actual,status:getComponentStatus(i.expectedQty,actual)} : i));
    setMessage("");
  }

  function handleApprove() {
    if (!canApprove(items)) { setMessage("Approval blocked: every component must be GREEN."); return; }
    setMessage("Batch approved successfully in the demo domain flow. Production API enforcement is added in the next implementation phase.");
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand">ApparelFlow ERP</div><div className="role-pill">Role: Cutting Verifier</div></header>
    <div className="layout"><aside className="sidebar"><Link className="nav-item" href="/">Dashboard</Link><Link className="nav-item" href="/orders">Cutting Orders</Link><Link className="nav-item active" href="/verification">Verification Terminal</Link><Link className="nav-item" href="/sewing">Sewing Queue</Link></aside>
      <main className="content">
        <h1 className="page-title">Verification Terminal</h1><p className="subtitle">Component-by-component QC gate for {order.orderNo} · {order.recipe.name}</p>
        <div className="card">
          <table className="table"><thead><tr><th>Component</th><th>Expected</th><th>Actual</th><th>Status</th></tr></thead><tbody>
          {items.map(i=><tr key={i.componentId}><td>{i.componentName}</td><td>{i.expectedQty}</td><td><input min="0" step="1" type="number" value={i.actualQty} onChange={e=>update(i.componentId,e.target.value)} /></td><td><span className={`badge ${i.status.toLowerCase()}`}>{i.status}</span></td></tr>)}
          </tbody></table>
          {message && <div className={`alert ${message.includes("success")?"alert-info":"alert-error"}`}>{message}</div>}
          <div className="actions" style={{marginTop:16}}>
            <button className="btn btn-success" disabled={!approve} onClick={handleApprove}>Approve Batch</button>
            <button className="btn btn-danger" onClick={()=>setMessage("Rejection requires a mandatory reason note in the server workflow.")}>Reject Batch</button>
          </div>
          {!approve && <div className="alert alert-error">Hard stop active: at least one component is not GREEN.</div>}
        </div>
      </main>
    </div>
  </div>;
}