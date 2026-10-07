import Link from "next/link";
import { demoOrders } from "@/data/demo";

export default function SewingPage() {
  const verified = demoOrders.filter(o => o.status === "VERIFIED");
  return <div className="app-shell"><header className="topbar"><div className="brand">ApparelFlow ERP</div><div className="role-pill">Role: Sewing Supervisor</div></header>
    <div className="layout"><aside className="sidebar"><Link className="nav-item" href="/">Dashboard</Link><Link className="nav-item" href="/orders">Cutting Orders</Link><Link className="nav-item" href="/verification">Verification Terminal</Link><Link className="nav-item active" href="/sewing">Sewing Queue</Link></aside>
      <main className="content"><h1 className="page-title">Sewing Queue</h1><p className="subtitle">Only VERIFIED production batches are released to assembly.</p>
      <div className="card"><table className="table"><thead><tr><th>Order</th><th>Recipe</th><th>Quantity</th><th>Verifier</th><th>Action</th></tr></thead><tbody>{verified.map(o=><tr key={o.id}><td>{o.orderNo}</td><td>{o.recipe.name}</td><td>{o.targetQty}</td><td>{o.verifier}</td><td><button className="btn btn-primary">Start Sewing Assembly</button></td></tr>)}</tbody></table>{verified.length===0 && <div className="alert alert-info">No verified batches are currently available.</div>}</div>
      </main></div></div>;
}