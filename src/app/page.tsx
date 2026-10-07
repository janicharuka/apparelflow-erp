import Link from "next/link";

export default function Home() {
  return (
    <div className="app-shell">
      <header className="topbar"><div className="brand">ApparelFlow ERP</div><div className="role-pill">Demo Environment</div></header>
      <div className="layout">
        <aside className="sidebar">
          <Link className="nav-item active" href="/">Dashboard</Link>
          <Link className="nav-item" href="/orders">Cutting Orders</Link>
          <Link className="nav-item" href="/verification">Verification Terminal</Link>
          <Link className="nav-item" href="/sewing">Sewing Queue</Link>
        </aside>
        <main className="content">
          <h1 className="page-title">Cutting Operations Dashboard</h1>
          <p className="subtitle">ApparelFlow ERP — Production Batch Verification & Sewing Queue Gate</p>
          <div className="grid grid-4">
            <div className="card"><div className="metric-label">Cutting In Progress</div><div className="metric">1</div></div>
            <div className="card"><div className="metric-label">Pending Verification</div><div className="metric">1</div></div>
            <div className="card"><div className="metric-label">Verified Batches</div><div className="metric">1</div></div>
            <div className="card"><div className="metric-label">Sewing Queue</div><div className="metric">1</div></div>
          </div>
          <div className="card" style={{marginTop:16}}>
            <h2 style={{fontSize:20,fontWeight:800,marginBottom:8}}>System Gatekeeper</h2>
            <p style={{color:"#475569"}}>A batch can enter the Sewing Queue only after every component is verified as GREEN by an authorized Cutting Verifier.</p>
            <div className="actions" style={{marginTop:16}}>
              <Link href="/orders" className="btn btn-primary">Manage Cutting Orders</Link>
              <Link href="/verification" className="btn btn-secondary">Open Verification Terminal</Link>
              <Link href="/sewing" className="btn btn-secondary">View Sewing Queue</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}