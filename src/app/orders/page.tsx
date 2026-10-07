import Link from "next/link";
import { recipes, demoOrders } from "@/data/demo";

export default function OrdersPage() {
  return <div className="app-shell">
    <header className="topbar"><div className="brand">ApparelFlow ERP</div><div className="role-pill">Role: Cutting Supervisor</div></header>
    <div className="layout">
      <aside className="sidebar">
        <Link className="nav-item" href="/">Dashboard</Link><Link className="nav-item active" href="/orders">Cutting Orders</Link>
        <Link className="nav-item" href="/verification">Verification Terminal</Link><Link className="nav-item" href="/sewing">Sewing Queue</Link>
      </aside>
      <main className="content">
        <h1 className="page-title">Cutting Orders</h1><p className="subtitle">Create production batches from approved recipes.</p>
        <div className="grid grid-2">
          {recipes.map(r => <div className="card" key={r.id}><div className="badge blue">{r.id}</div><h2 style={{fontSize:20,fontWeight:800,marginTop:8}}>{r.name}</h2><p style={{color:"#64748b"}}>{r.category} · {r.stdFabricYards} yds/piece · wastage cap {r.wastageCap}%</p><ul style={{paddingLeft:20,lineHeight:1.8}}>{r.components.map(c=><li key={c.id}>{c.name} — {c.piecesPerGarment} pcs/garment</li>)}</ul></div>)}
        </div>
        <div className="card" style={{marginTop:16}}>
          <h2 style={{fontSize:20,fontWeight:800,marginBottom:12}}>Current Production Batches</h2>
          <table className="table"><thead><tr><th>Order</th><th>Recipe</th><th>Qty</th><th>Status</th><th></th></tr></thead><tbody>
          {demoOrders.map(o=><tr key={o.id}><td>{o.orderNo}</td><td>{o.recipe.name}</td><td>{o.targetQty}</td><td><span className={`badge ${o.status==="VERIFIED"?"green":"yellow"}`}>{o.status}</span></td><td>{o.status==="PENDING_VERIFICATION" && <Link className="btn btn-primary" href={`/verification?order=${o.id}`}>Verify</Link>}</td></tr>)}
          </tbody></table>
        </div>
      </main>
    </div>
  </div>;
}